import { state } from './state.js';
import { escapeHtml, getEl } from './utils.js';
import { getFileUrl, getAuthModel } from './api.js';

export let els = {}; // To be initialized

const STATUS_MAP = {
    pending_application: "待申请",
    in_invoicing: "开票中",
    in_reimbursement: "报销中",
    reimbursed: "已报销"
};

const STATUS_COLORS = {
    pending_application: "secondary",
    in_invoicing: "warning",
    in_reimbursement: "primary",
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
        statusFilter: getEl("statusFilter"),
        itemsPerPageSelect: getEl("itemsPerPageSelect"),
        invoiceList: getEl("invoiceList"),
        pagination: getEl("pagination"),
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
        description: getEl("description"),
        attachments: getEl("attachments"),
        fileChosenText: getEl("file-chosen-text"),
        attachmentPreview: getEl("attachmentPreview"),
        confirmDeleteModal: getEl("confirmDeleteModal"),
        confirmDeleteBtn: getEl("confirmDeleteBtn")
    };
    return Object.values(els).every(el => el !== null);
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
        } else {
            const nameEnc = encodeURIComponent(model.email);
            els.currentAvatarImg.src = `https://ui-avatars.com/api/?name=${nameEnc}&background=0D6EFD&color=ffffff&size=64`;
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
        return;
    }
    els.pagination.style.visibility = "visible";

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
        container.innerHTML = "<small class='text-muted'>No existing attachments</small>";
        return;
    }

    state.currentAttachments.forEach(f => {
        const div = document.createElement("div");
        div.className = "d-flex align-items-center mb-1 bg-light p-1 rounded";
        
        const fileUrl = getFileUrl(state.currentRecord, f);
        div.innerHTML = `
            <i class="bi bi-paperclip me-2 text-secondary"></i>
            <a href="${fileUrl}" target="_blank" class="text-decoration-none text-truncate me-auto" style="max-width: 300px;">${f}</a>
            <button type="button" class="btn btn-sm text-danger ms-2 remove-attachment-btn" data-filename="${f}"><i class="bi bi-x-lg"></i></button>
        `;
        
        container.appendChild(div);
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
    
    toastEl.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}
