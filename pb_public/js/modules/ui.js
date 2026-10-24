import { state } from './state.js';
import { escapeHtml, getEl } from './utils.js';
import { getFileUrl, getAuthModel } from './api.js';

export let els = {}; // To be initialized

export const STATUS_MAP = {
    pending_application: "待申请",
    in_invoicing: "开票中",
    in_reimbursement: "报销中",
    reimbursed: "已报销"
};

export const STATUS_COLORS = {
    pending_application: "secondary",
    in_invoicing: "warning",
    in_reimbursement: "info",
    reimbursed: "success"
};

/**
 * Initializes all DOM element references.
 */
export function initializeElements() {
    els = {
        loginForm: getEl("loginForm"),
        loginSection: getEl("loginSection"),
        mainSection: getEl("mainSection"),
        logoutBtn: getEl("logoutBtn"),
        currentUserSpan: getEl("currentUser"),
        currentAvatarImg: getEl("currentAvatar"),
        addInvoiceBtn: getEl("addInvoiceBtn"),
        recognizeInvoiceNumberBtn: getEl("recognizeInvoiceNumberBtn"),
        searchInput: getEl("searchInput"),
        searchClearBtn: getEl("searchClearBtn"),
        statusFilter: getEl("statusFilter"),
        attributionFilter: getEl("attributionFilter"),
        itemsPerPageSelect: getEl("itemsPerPageSelect"),
        invoiceList: getEl("invoiceList"),
        pagination: getEl("pagination"),
        pageInfo: getEl("pageInfo"),
        paginationControls: getEl("paginationControlsWrapper"),
        noInvoicesMessage: getEl("noInvoicesMessage"),
        loading: getEl("loading"),
        selectAllCheckbox: getEl("selectAllCheckbox"),
        batchActions: getEl("batchActions"),
        selectedCount: getEl("selectedCount"),
        totalAmountValue: getEl("totalAmountValue"),
        batchStatusSelect: getEl("batchStatusSelect"),
        batchSetStatusBtn: getEl("batchSetStatusBtn"),
        batchDownloadBtn: getEl("batchDownloadBtn"),
        batchDeleteBtn: getEl("batchDeleteBtn"),
        deselectAllBtn: getEl("deselectAllBtn"),
        invoiceModal: getEl("invoiceModal"),
        modalTitle: getEl("modalTitle"),
        invoiceForm: getEl("invoiceForm"),
        invoiceId: getEl("invoiceId"),
        invoiceNumber: getEl("invoiceNumber"),
        invoiceDate: getEl("invoiceDate"),
        vendor: getEl("vendor"),
        amount: getEl("amount"),
        status: getEl("status"),
        attribution: getEl("attribution"),
        description: getEl("description"),
        attachments: getEl("attachments"),
        fileChosenText: getEl("file-chosen-text"),
        attachmentPreview: getEl("attachmentPreview"),
        confirmDeleteModal: getEl("confirmDeleteModal"),
        confirmDeleteBtn: getEl("confirmDeleteBtn"),
        // Stats cards
        statsRow: getEl("statsRow"),
        statCount: getEl("statCount"),
        statAmount: getEl("statAmount"),
        statPending: getEl("statPending"),
        statReimbursed: getEl("statReimbursed"),
        // New (unsaved) files preview
        newFilesList: getEl("newFilesList"),
        // Delete modal dynamic text
        confirmDeleteTitle: getEl("confirmDeleteTitle"),
        confirmDeleteBody: getEl("confirmDeleteBody")
    };
    return Object.values(els).every(el => el !== null);
}

/**
 * 生成本地首字母头像的 SVG data URI（不向第三方服务发送用户邮箱）。
 * 防御性：即使 PocketBase 已校验 email 格式，对 initial 也做 HTML 转义，
 * 防止首字母为 < / & / " 等特殊字符时破坏 SVG 标记或产生注入。
 * fill 使用青绿主题色 (%23 = '#')。
 * @param {string} email 用户邮箱。
 * @returns {string} SVG data URI。
 */
function buildInitialAvatar(email) {
    const initial = escapeHtml((email || "?").charAt(0).toUpperCase());
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' fill='%230d9488'/><text x='32' y='32' dominant-baseline='central' text-anchor='middle' font-size='28' font-family='sans-serif' fill='white'>${initial}</text></svg>`;
}

/**
 * Renders the main UI based on authentication status.
 */
export function renderUI(loadInvoicesCallback) {
    const model = getAuthModel();
    if (model) {
        els.loginSection.style.display = "none";
        els.mainSection.style.display = "";
        els.logoutBtn.style.display = "";
        els.currentUserSpan.style.display = "";
        els.currentUserSpan.textContent = model.email;
        els.currentAvatarImg.style.display = "";
        if (model.avatar) {
            els.currentAvatarImg.src = getFileUrl(model, model.avatar);
            // 头像文件在服务端缺失（被清理/改名导致 404）时，回退到本地生成的首字母头像
            els.currentAvatarImg.onerror = () => {
                els.currentAvatarImg.onerror = null;
                els.currentAvatarImg.src = buildInitialAvatar(model.email);
            };
        } else {
            els.currentAvatarImg.onerror = null;
            els.currentAvatarImg.src = buildInitialAvatar(model.email);
        }
        state.itemsPerPage = parseInt(els.itemsPerPageSelect.value, 10);
        loadInvoicesCallback();
    } else {
        els.loginSection.style.display = "";
        els.mainSection.style.display = "none";
        els.logoutBtn.style.display = "none";
        els.currentUserSpan.style.display = "none";
        els.currentAvatarImg.style.display = "none";
    }
}

/**
 * Creates a table row for an invoice.
 * @param {object} rec The invoice record.
 * @param {function} onSelect The selection handler.
 * @param {function} onEdit The edit handler.
 * @param {function} onDelete The delete handler.
 * @returns {HTMLTableRowElement} The created table row.
 */
export function createInvoiceRow(rec, { onSelect, onEdit, onDelete }) {
    const tr = document.createElement("tr");
    tr.className = `invoice-row ${state.selected.has(rec.id) ? "selected" : ""}`;
    tr.dataset.id = rec.id;
    tr.dataset.amount = rec.amount;

    tr.innerHTML = `
        <td><input type="checkbox" class="form-check-input row-select-checkbox" ${state.selected.has(rec.id) ? "checked" : ""}></td>
        <td class="user-select-all">${escapeHtml(rec.invoice_number)}</td>
        <td>${rec.invoice_date ? rec.invoice_date.slice(0, 10) : '-'}</td>
        <td>${escapeHtml(rec.vendor)}</td>
        <td class="text-end">¥${Number(rec.amount).toFixed(2)}</td>
        <td><span class="badge bg-${STATUS_COLORS[rec.status] || 'secondary'}">${STATUS_MAP[rec.status] || rec.status}</span></td>
        <td class="text-truncate" style="max-width: 110px;" title="${escapeHtml(rec.attribution || '')}">${escapeHtml(rec.attribution || 'Default')}</td>
        <td class="text-truncate" style="max-width: 150px;" title="${escapeHtml(rec.description || '')}">${escapeHtml(rec.description || "-")}</td>
        <td class="text-center">${(rec.attachments || []).length === 0 ? "无" : (rec.attachments || []).map((_, i) => `<i class="bi bi-file-earmark-pdf-fill text-danger me-1" title="附件${i + 1}"></i>`).join("")}</td>
        <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-1 edit-btn" title="编辑"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-btn" title="删除"><i class="bi bi-trash"></i></button>
        </td>`;

    const checkbox = tr.querySelector(".row-select-checkbox");
    checkbox.addEventListener('change', () => {
        onSelect(rec.id, tr, checkbox);
    });

    tr.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('.btn')) return;
        onSelect(rec.id, tr, checkbox);
    });
    
    tr.querySelector(".edit-btn").addEventListener('click', (e) => {
        e.stopPropagation();
        onEdit(rec);
    });
    tr.querySelector(".delete-btn").addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete(rec.id);
    });

    return tr;
}

/**
 * 显示/隐藏搜索框的“清空”按钮。
 * @param {boolean} visible 是否可见。
 */
export function toggleSearchClear(visible) {
    if (els.searchClearBtn) els.searchClearBtn.style.display = visible ? "" : "none";
}

/**
 * Updates the batch actions UI based on the selection.
 */
export function updateBatchUI() {
    const count = state.selected.size;
    els.totalAmountValue.textContent = state.totalAmount.toFixed(2);
    els.selectedCount.textContent = String(count);

    if (count > 0) {
        els.batchActions.style.display = "flex";
        setTimeout(() => els.batchActions.classList.add("show"), 10);
    } else {
        els.batchActions.classList.remove("show");
        setTimeout(() => {
            if (!els.batchActions.classList.contains("show")) {
                els.batchActions.style.display = "none";
            }
        }, 300);
    }
}

/**
 * Updates the sort indicators in the table header.
 * @param {HTMLElement} clickedTh The clicked table header element.
 */
export function updateSortIcons(clickedTh) {
    document.querySelectorAll("th[data-sort-by] i").forEach(icon => {
        icon.classList.remove("bi-sort-alpha-up", "bi-sort-alpha-down", "bi-sort-numeric-up", "bi-sort-numeric-down", "active");
        
        const th = icon.closest('th');
        const sortBy = th.dataset.sortBy;
        let defaultIcon = 'bi-sort-alpha-down';
        if (sortBy === 'amount') {
            defaultIcon = 'bi-sort-numeric-down';
        }
        icon.classList.add(defaultIcon);
    });

    const icon = clickedTh.querySelector("i");
    if (icon) {
        const sortBy = clickedTh.dataset.sortBy;
        let upClass = 'bi-sort-alpha-up';
        let downClass = 'bi-sort-alpha-down';

        if (sortBy === 'amount') {
            upClass = 'bi-sort-numeric-up';
            downClass = 'bi-sort-numeric-down';
        }
        
        icon.classList.remove(downClass, upClass);

        if (state.sortOrder === "asc") {
            icon.classList.add(downClass);
        } else {
            icon.classList.add(upClass);
        }
        icon.classList.add("active");
    }
}

/**
 * Renders the pagination controls.
 * @param {number} totalItems The total number of items.
 * @param {function} onPageChange The page change handler.
 */
export function renderPagination(totalItems, onPageChange) {
    const p = els.pagination;
    p.innerHTML = "";

    if (totalItems === 0) {
        els.pagination.style.visibility = "hidden";
        if (els.pageInfo) els.pageInfo.style.display = "none";
        return;
    }
    els.pagination.style.visibility = "visible";

    if (els.pageInfo) {
        els.pageInfo.textContent = `共 ${totalItems} 条记录 · 第 ${state.currentPage} / ${state.totalPages} 页`;
        els.pageInfo.style.display = "";
    }

    const createPageItem = (page, text, isActive = false, isDisabled = false) => {
        const li = document.createElement("li");
        li.className = `page-item ${isActive ? "active" : ""} ${isDisabled ? "disabled" : ""}`;
        li.innerHTML = `<a class="page-link" href="#">${text}</a>`;
        if (!isDisabled && !isActive) {
            li.onclick = (e) => { e.preventDefault(); onPageChange(page); };
        }
        return li;
    };

    p.appendChild(createPageItem(state.currentPage - 1, "&laquo;", false, state.currentPage === 1));

    let start = Math.max(1, state.currentPage - 2);
    let end = Math.min(state.totalPages, state.currentPage + 2);

    if(start > 1) p.appendChild(createPageItem(1, "1"));
    if(start > 2) p.appendChild(createPageItem(0, "...", false, true));

    for (let i = start; i <= end; i++) {
        p.appendChild(createPageItem(i, i, i === state.currentPage));
    }

    if(end < state.totalPages - 1) p.appendChild(createPageItem(0, "...", false, true));
    if(end < state.totalPages) p.appendChild(createPageItem(state.totalPages, state.totalPages));

    p.appendChild(createPageItem(state.currentPage + 1, "&raquo;", false, state.currentPage === state.totalPages));
}


/**
 * Renders the attachment preview in the modal.
 */
export function renderAttachmentPreview() {
    const container = els.attachmentPreview;
    container.innerHTML = "";

    if (state.currentAttachments.length === 0) {
        container.innerHTML = "<small class='text-muted'>暂无附件</small>";
        return;
    }

    state.currentAttachments.forEach(f => {
        const div = document.createElement("div");
        div.className = "d-flex align-items-center mb-1 bg-light p-1 rounded";
        
        const fileUrl = getFileUrl(state.currentRecord, f);
        const icon = document.createElement('i');
        icon.className = 'bi bi-paperclip me-2 text-secondary';

        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.className = 'text-decoration-none text-truncate me-auto';
        link.style.maxWidth = '300px';
        link.textContent = f;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm text-danger ms-2 remove-attachment-btn';
        removeBtn.dataset.filename = f;
        removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';

        div.appendChild(icon);
        div.appendChild(link);
        div.appendChild(removeBtn);
        
        container.appendChild(div);
    });
}


/**
 * Renders the stats cards based on the currently visible invoice items.
 * Stats are computed from the current view (not a global aggregate) to avoid
 * an extra API request; the label makes this scope explicit.
 * @param {Array} items The invoice records currently rendered in the table.
 */
export function renderStats(items) {
    if (!els.statsRow) return;
    const list = items || [];
    const total = list.length;
    const totalAmount = list.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const pending = list.filter(r => r.status !== 'reimbursed').length;
    const reimbursed = list.filter(r => r.status === 'reimbursed').length;

    els.statCount.textContent = String(total);
    els.statAmount.textContent = totalAmount.toFixed(2);
    els.statPending.textContent = String(pending);
    els.statReimbursed.textContent = String(reimbursed);
}

/**
 * Renders placeholder skeleton rows while invoice data is loading, replacing
 * the previous "clear table → spinner → fill" flicker.
 * @param {number} rows Number of skeleton rows to render.
 */
export function renderSkeletonRows(rows = 6) {
    if (!els.invoiceList) return;
    els.invoiceList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement("tr");
        tr.className = "skeleton-row";
        for (let c = 0; c < 10; c++) {
            const td = document.createElement("td");
            const bar = document.createElement("div");
            bar.className = "skeleton-cell";
            // Vary widths slightly so it doesn't look like a uniform grid.
            const widths = ["70%", "55%", "80%", "60%", "50%", "45%", "55%", "75%", "30%", "40%"];
            bar.style.width = widths[c] || "50%";
            td.appendChild(bar);
            tr.appendChild(td);
        }
        fragment.appendChild(tr);
    }
    els.invoiceList.appendChild(fragment);
}

/**
 * Renders chips for newly-selected (not-yet-saved) attachment files, so the
 * user can see which files they picked before saving — and remove them.
 * Existing saved attachments are rendered separately by renderAttachmentPreview.
 * @param {FileList|Array} files The files currently chosen in the file input.
 */
export function renderNewFilesPreview(files) {
    if (!els.newFilesList) return;
    els.newFilesList.innerHTML = "";
    const arr = files ? Array.from(files) : [];
    if (arr.length === 0) {
        els.newFilesList.style.display = "none";
        return;
    }
    els.newFilesList.style.display = "";

    arr.forEach((file) => {
        const chip = document.createElement("div");
        chip.className = "new-file-chip";

        const icon = document.createElement("i");
        icon.className = "bi bi-file-earmark-pdf text-danger";

        const name = document.createElement("span");
        name.className = "chip-name";
        name.textContent = file.name;
        name.title = file.name;

        const size = document.createElement("span");
        size.className = "text-muted";
        size.style.fontSize = "0.72rem";
        size.textContent = (file.size / 1024).toFixed(0) + " KB";

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "chip-remove";
        remove.title = "移除";
        remove.setAttribute("aria-label", "移除 " + file.name);
        remove.innerHTML = '<i class="bi bi-x-lg"></i>';
        // Mark for the delegated removal handler in app.js
        remove.dataset.fileName = file.name;

        chip.appendChild(icon);
        chip.appendChild(name);
        chip.appendChild(size);
        chip.appendChild(remove);
        els.newFilesList.appendChild(chip);
    });
}


export function showLoader() { 
    if (els.loading) els.loading.style.display = ""; 
}

export function hideLoader() { 
    if (els.loading) els.loading.style.display = "none"; 
}

export function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    const toastBody = document.createElement('div');
    toastBody.className = 'toast-body';
    toastBody.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close btn-close-white me-2 m-auto';
    closeBtn.setAttribute('data-bs-dismiss', 'toast');

    const row = document.createElement('div');
    row.className = 'd-flex';
    row.appendChild(toastBody);
    row.appendChild(closeBtn);
    toastEl.appendChild(row);

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}
