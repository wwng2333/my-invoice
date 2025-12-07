import { state } from './modules/state.js';
import { debounce, convertChineseToNumber } from './modules/utils.js';
import * as api from './modules/api.js';
import * as ui from './modules/ui.js';

export const CONFIG = {
    PB_URL: "https://invoice.csgo.ovh/",
    TIMEOUT: {
        INIT_RETRY: 500,
        INIT_DELAY: 100,
        SEARCH_DEBOUNCE: 300
    },
    PAGE_SIZES: [10, 25, 50, 9999],
    RETRY_MAX: 3
};

let bsInvoiceModal = null;
let bsConfirmDeleteModal = null;
let initRetryCount = 0;
let initialized = false;
let isLoggingIn = false;

function safeInitialize() {
    if (initialized) return;

    if (!ui.initializeElements()) {
        initRetryCount++;
        if (initRetryCount <= CONFIG.RETRY_MAX) {
            console.warn(`DOM elements not loaded, retrying in ${CONFIG.TIMEOUT.INIT_RETRY}ms (${initRetryCount}/${CONFIG.RETRY_MAX})`);
            setTimeout(safeInitialize, CONFIG.TIMEOUT.INIT_RETRY);
            return;
        } else {
            console.error("Initialization failed: Could not load key DOM elements.");
            return;
        }
    }
    
    console.log("✓ DOM elements loaded, initializing application.");
    
    try {
        bsInvoiceModal = new bootstrap.Modal(ui.els.invoiceModal);
        bsConfirmDeleteModal = new bootstrap.Modal(ui.els.confirmDeleteModal);
        
        setupEventListeners();
        ui.renderUI(loadInvoices);
        
        initialized = true;
        console.log("✓ Application initialized successfully.");

        // Hide the loading overlay
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }

    } catch (e) {
        console.error("Error during initialization:", e);
        ui.showToast("Application failed to initialize. Please refresh.", 'danger');
    }
}

function setupEventListeners() {
    ui.els.loginForm.addEventListener("submit", handleLogin);
    ui.els.logoutBtn.addEventListener('click', handleLogout);

    ui.els.invoiceForm.addEventListener("submit", handleSaveInvoice);
    ui.els.confirmDeleteBtn.addEventListener('click', handleDelete);

    ui.els.searchInput.oninput = debounce(() => { state.currentPage = 1; loadInvoices(); }, CONFIG.TIMEOUT.SEARCH_DEBOUNCE);
    ui.els.statusFilter.onchange = () => { state.currentPage = 1; loadInvoices(); };

    document.querySelectorAll("th[data-sort-by]").forEach(th => th.addEventListener("click", handleSortClick));
    ui.els.itemsPerPageSelect.onchange = handlePageSizeChange;

    ui.els.batchDeleteBtn.onclick = confirmBatchDelete;
    ui.els.batchSetStatusBtn.onclick = handleBatchSetStatus;
    ui.els.batchDownloadBtn.onclick = handleBatchDownload;
    ui.els.deselectAllBtn.onclick = deselectAll;
    ui.els.selectAllCheckbox.onchange = handleSelectAll;

    ui.els.addInvoiceBtn.onclick = () => openModal();
    ui.els.recognizeInvoiceNumberBtn.onclick = handleRecognizePDF;
    
    document.addEventListener("keydown", handleGlobalKeys);

    ui.els.attachmentPreview.addEventListener('click', (e) => {
        if (e.target.closest('.remove-attachment-btn')) {
            const filename = e.target.closest('.remove-attachment-btn').dataset.filename;
            state.currentAttachments = state.currentAttachments.filter(item => item !== filename);
            ui.renderAttachmentPreview();
        }
    });

    ui.els.attachments.addEventListener('change', () => {
        const numFiles = ui.els.attachments.files.length;
        if (numFiles > 0) {
            ui.els.fileChosenText.textContent = `${numFiles} 个文件已选择`;
        } else {
            ui.els.fileChosenText.textContent = '未选择文件';
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
	if (isLoggingIn) return;

    isLoggingIn = true;
    const loginButton = ui.els.loginForm.querySelector('button[type="submit"]');
    const email = ui.els.loginForm.email.value;
    const password = ui.els.loginForm.password.value;

    if (!email || !password) {
		isLoggingIn = false;
        return ui.showToast("Please enter email and password", 'warning');
    }

    loginButton.disabled = true;
    loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';

    try {
        if (await api.login(email, password)) {
            ui.renderUI(loadInvoices);
        }
    } finally {
		isLoggingIn = false;
        loginButton.disabled = false;
        loginButton.innerHTML = '登录';
    }
}


function handleLogout() {
    api.logout();
    state.selected.clear();
    state.totalAmount = 0;
    ui.renderUI(loadInvoices);
}

function handleSortClick(e) {
    const th = e.currentTarget;
    const sortBy = th.dataset.sortBy;
    state.sortOrder = (state.sortBy === sortBy && state.sortOrder === "desc") ? "asc" : "desc";
    state.sortBy = sortBy;
    ui.updateSortIcons(th);
    loadInvoices();
}

function handlePageSizeChange() {
    state.itemsPerPage = parseInt(ui.els.itemsPerPageSelect.value);
    state.currentPage = 1;
    loadInvoices();
}

async function loadInvoices() {
    ui.showLoader();
    ui.els.invoiceList.innerHTML = "";
    
    state.selected.clear();
    state.totalAmount = 0;
    ui.updateBatchUI();
    ui.els.selectAllCheckbox.checked = false;

    const result = await api.getInvoices();

    if (result) {
        const fragment = document.createDocumentFragment();
        result.items.forEach(r => fragment.appendChild(ui.createInvoiceRow(r, {
            onSelect: toggleSelect,
            onEdit: openModal,
            onDelete: confirmSingleDelete
        })));
        ui.els.invoiceList.appendChild(fragment);
        
        ui.els.noInvoicesMessage.style.display = result.items.length === 0 ? "" : "none";
        
        state.currentPage = result.page;
        state.totalPages = result.totalPages;
        ui.renderPagination(result.totalItems, (page) => {
            state.currentPage = page;
            loadInvoices();
        });
    }
    ui.hideLoader();
}

function toggleSelect(id, row, checkbox) {
    const amount = Number(row.dataset.amount);
    if (state.selected.has(id)) {
        state.selected.delete(id);
        row.classList.remove("selected");
        checkbox.checked = false;
        state.totalAmount -= amount;
    } else {
        state.selected.add(id);
        row.classList.add("selected");
        checkbox.checked = true;
        state.totalAmount += amount;
    }
    ui.updateBatchUI();
    checkSelectAllStatus();
}

function checkSelectAllStatus() {
    const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
    if(allCheckboxes.length === 0) {
        ui.els.selectAllCheckbox.checked = false;
        return;
    }
    ui.els.selectAllCheckbox.checked = Array.from(allCheckboxes).every(cb => cb.checked);
}

async function openModal(rec = null) {
    ui.els.invoiceForm.reset();
    ui.els.attachments.value = '';
    ui.els.fileChosenText.textContent = '未选择文件';
    ui.els.invoiceId.value = rec ? rec.id : "";
    state.currentAttachments = rec?.attachments ? [...rec.attachments] : [];
    ui.els.attachmentPreview.innerHTML = "";
    ui.els.modalTitle.textContent = rec ? "Edit Invoice" : "Add Invoice";

    if (rec) {
        state.currentRecord = await api.getInvoice(rec.id) || rec;
        ui.els.invoiceNumber.value = rec.invoice_number;
        ui.els.invoiceDate.value = rec.invoice_date ? rec.invoice_date.slice(0, 10) : "";
        ui.els.vendor.value = rec.vendor;
        ui.els.amount.value = rec.amount;
        ui.els.status.value = rec.status;
        ui.els.description.value = rec.description || "";
        ui.renderAttachmentPreview();
    } else {
        state.currentRecord = null;
    }
    bsInvoiceModal.show();
}

async function handleRecognizePDF() {
    const files = ui.els.attachments.files;
    if (files.length === 0) return ui.showToast("Please select a PDF file first!", 'warning');
    
    const btn = ui.els.recognizeInvoiceNumberBtn;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Recognizing...`;

    try {
        const file = files[0];
        if (file.type !== "application/pdf") throw new Error("Must be a PDF file");

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, cMapUrl: './cmaps/', cMapPacked: true }).promise;

        let fullText = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join("");
        }

        const cleanText = fullText.replace(/\s+/g, "");
        
        const amountNumRegex = /(?:小写|金额|计)\D{0,5}?([¥￥]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/;
        const numMatch = cleanText.match(amountNumRegex);
        if (numMatch) {
            ui.els.amount.value = parseFloat(numMatch[1].replace(/[¥￥,\s]/g, '')).toFixed(2);
        } else {
            const chineseAmountRegex = /([零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元角分整]{4,})/; 
            const cnMatch = cleanText.match(chineseAmountRegex);
            if (cnMatch) ui.els.amount.value = convertChineseToNumber(cnMatch[1]).toFixed(2);
        }

        const invoiceNumRegex = /(?:发票号码|No\.|NO\.)[:：]?(\d{8,20})/;
        const numMatchInv = cleanText.match(invoiceNumRegex);
        if (numMatchInv) {
            ui.els.invoiceNumber.value = numMatchInv[1];
        } else {
            const looseMatch = cleanText.match(/\d{20}/) || cleanText.match(/\d{10,12}/);
            if(looseMatch) ui.els.invoiceNumber.value = looseMatch[0];
        }

        const dateRegex = /(\d{4})[.\-年](\d{1,2})[.\-月](\d{1,2})/; 
        const dateMatch = cleanText.match(dateRegex);
        if(dateMatch) {
            const [_, year, month, day] = dateMatch.map(s => s.padStart(2, '0'));
            ui.els.invoiceDate.value = `${year}-${month}-${day}`;
            if (ui.els.invoiceDate._flatpickr) {
                ui.els.invoiceDate._flatpickr.setDate(`${year}-${month}-${day}`);
            }
        }

        ui.showToast("Recognition complete, please verify the information.", 'success');

    } catch (error) {
        console.error(error);
        ui.showToast("Recognition failed: " + error.message, 'warning');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleSaveInvoice(e) {
    e.preventDefault();
    const id = ui.els.invoiceId.value;
    const fd = new FormData(ui.els.invoiceForm);
    
    if (state.currentRecord?.attachments) {
        const toRemove = state.currentRecord.attachments.filter(f => !state.currentAttachments.includes(f));
        toRemove.forEach(f => fd.append("attachments-", f));
    }
    
    fd.delete("attachments"); 
    if (ui.els.attachments.files.length > 0) {
        for (const file of ui.els.attachments.files) {
            fd.append("attachments", file);
        }
    }

    if (await api.saveInvoice(id, fd)) {
        bsInvoiceModal.hide();
        loadInvoices();
    }
}

function confirmSingleDelete(id) {
    ui.els.confirmDeleteBtn.dataset.deleteId = id;
    ui.els.confirmDeleteBtn.dataset.deleteType = 'single';
    bsConfirmDeleteModal.show();
}

function confirmBatchDelete() {
    if (!state.selected.size) return ui.showToast("Please select invoices", 'warning');
    ui.els.confirmDeleteBtn.dataset.deleteType = 'batch';
    bsConfirmDeleteModal.show();
}

async function handleDelete() {
    const type = ui.els.confirmDeleteBtn.dataset.deleteType;
    ui.showLoader();
    let success = false;
    if (type === 'single') {
        success = await api.deleteInvoice(ui.els.confirmDeleteBtn.dataset.deleteId);
    } else {
        const deletions = [...state.selected].map(id => api.deleteInvoice(id));
        const results = await Promise.all(deletions);
        success = results.every(r => r);
        if (success) deselectAll();
    }

    if (success) {
        ui.showToast("Deletion successful", 'success');
        bsConfirmDeleteModal.hide();
        loadInvoices();
    }
    ui.hideLoader();
}

async function handleBatchSetStatus() {
    const newStatus = ui.els.batchStatusSelect.value;
    if (!newStatus) return ui.showToast("Please select a status", 'warning');
    if (!state.selected.size) return;

    ui.showLoader();
    if (await api.batchUpdateInvoices(state.selected, newStatus)) {
        deselectAll();
        loadInvoices();
        ui.els.batchStatusSelect.value = "";
    }
    ui.hideLoader();
}

async function handleBatchDownload() {
    if (!state.selected.size) return;
    ui.showLoader();
    
    try {
        const zip = new JSZip();
        const invoicesData = [];
        
        const promises = [...state.selected].map(async id => {
            const rec = await api.getInvoice(id);
            if (!rec) return;

            invoicesData.push({
                "Invoice Number": rec.invoice_number,
                "Date": rec.invoice_date ? rec.invoice_date.slice(0, 10) : '',
                "Vendor": rec.vendor,
                "Amount": rec.amount,
                "Status": ui.STATUS_MAP[rec.status] || rec.status,
                "Description": rec.description
            });

            if(rec.attachments?.length) {
                for(let i=0; i<rec.attachments.length; i++) {
                    const filename = rec.attachments[i];
                    const fileUrl = api.getFileUrl(rec, filename);
                    const blob = await fetch(fileUrl).then(r => r.blob());
                    zip.file(`${rec.invoice_number}_${i+1}.${filename.split('.').pop()}`, blob);
                }
            }
        });

        await Promise.all(promises);

        if (invoicesData.length > 0) {
            const headers = Object.keys(invoicesData[0]);
            const csvRows = [
                headers.join(','),
                ...invoicesData.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
            ];
            zip.file("invoice_list.csv", "\ufeff" + csvRows.join('\n'));
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Invoices_Export_${new Date().toISOString().slice(0,10)}.zip`);

    } catch(e) {
        ui.showToast("Download error: " + e.message, 'danger');
    }
    
    ui.hideLoader();
}

function deselectAll() {
    state.selected.clear();
    document.querySelectorAll(".invoice-row.selected").forEach(c => c.classList.remove("selected"));
    document.querySelectorAll(".row-select-checkbox").forEach(c => c.checked = false);
    state.totalAmount = 0;
    ui.updateBatchUI();
    ui.els.selectAllCheckbox.checked = false;
}

function handleSelectAll() {
    const isChecked = ui.els.selectAllCheckbox.checked;
    const rows = document.querySelectorAll(".invoice-row");
    
    rows.forEach(row => {
        const id = row.dataset.id;
        const checkbox = row.querySelector(".row-select-checkbox");
        const amount = Number(row.dataset.amount);

        const isSelected = state.selected.has(id);

        if (isChecked && !isSelected) {
            state.selected.add(id);
            row.classList.add("selected");
            checkbox.checked = true;
            state.totalAmount += amount;
        } else if (!isChecked && isSelected) {
            state.selected.delete(id);
            row.classList.remove("selected");
            checkbox.checked = false;
            state.totalAmount -= amount;
        }
    });
    ui.updateBatchUI();
}

function handleGlobalKeys(e) {
    if (ui.els.invoiceModal.classList.contains('show')) return;

    if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
        if(allCheckboxes.length === 0) return;
        
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        if (allChecked) {
            deselectAll();
        } else {
            ui.els.selectAllCheckbox.checked = true;
            handleSelectAll();
        }
    }

    if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        ui.els.searchInput.focus();
    }
    
    if (e.key === "Escape") {
        deselectAll();
    }
}

document.addEventListener("DOMContentLoaded", safeInitialize);

flatpickr("#invoiceDate", {
    dateFormat: "Y-m-d",
    locale: flatpickr.l10ns.zh,
    allowInput: true 
});