/* 配置常量 */
const PB_URL = "https://invoice.csgo.ovh/"; // 开发时可改为 'http://127.0.0.1:8090'
const pb = new PocketBase(PB_URL);

/* DOM 引用 (使用解构赋值简化) */
const getEl = (id) => document.getElementById(id);
const els = {
    loginForm: getEl("loginForm"),
    loginSection: getEl("loginSection"),
    mainSection: getEl("mainSection"),
    logoutBtn: getEl("logoutBtn"),
    currentUserSpan: getEl("currentUser"),
    currentAvatarImg: getEl("currentAvatar"),
    addInvoiceBtn: getEl("addInvoiceBtn"),
    modalTitle: getEl("modalTitle"),
    invoiceForm: getEl("invoiceForm"),
    saveInvoiceBtn: getEl("saveInvoiceBtn"),
    invoiceList: getEl("invoiceList"),
    loading: getEl("loading"),
    searchInput: getEl("searchInput"),
    statusFilter: getEl("statusFilter"),
    batchActions: getEl("batchActions"),
    batchDeleteBtn: getEl("batchDeleteBtn"),
    batchDownloadBtn: getEl("batchDownloadBtn"),
    deselectAllBtn: getEl("deselectAllBtn"),
    batchTotalAmount: getEl("batchTotalAmount"),
    batchCount: getEl("batchCount"),
    selectAllCheckbox: getEl("selectAllCheckbox"),
    batchStatusSelect: getEl("batchStatusSelect"),
    batchSetStatusBtn: getEl("batchSetStatusBtn"),
    attachments: getEl("attachments"), // 注意：不需要设为 let，直接通过 value 清空
    pagination: getEl("pagination"),
    itemsPerPageSelect: getEl("itemsPerPageSelect"),
    recognizeInvoiceNumberBtn: getEl("recognizeInvoiceNumberBtn"),
    noInvoicesMessage: getEl("noInvoicesMessage"),
    invoiceModal: getEl("invoiceModal"),
    confirmDeleteModal: getEl("confirmDeleteModal"),
    confirmDeleteBtn: getEl("confirmDeleteBtn"),
    paginationControls: getEl("paginationControlsWrapper"),
    totalAmountValue: getEl("totalAmountValue"),
    selectedCount: getEl("selectedCount"),
    invoiceId: getEl("invoiceId"),
    invoiceNumber: getEl("invoiceNumber"),
    invoiceDate: getEl("invoiceDate"),
    vendor: getEl("vendor"),
    amount: getEl("amount"),
    status: getEl("status"),
    description: getEl("description"),
    attachmentPreview: getEl("attachmentPreview")
};

/* 状态变量 */
const state = {
    selected: new Set(),
    totalAmount: 0,
    currentAttachments: [],
    currentRecord: null,
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 0,
    sortBy: "invoice_date",
    sortOrder: "desc"
};

/* Bootstrap 实例 */
let bsInvoiceModal;
let bsConfirmDeleteModal;

/* ---------- 初始化 ---------- */
document.addEventListener("DOMContentLoaded", () => {
    bsInvoiceModal = new bootstrap.Modal(els.invoiceModal);
    bsConfirmDeleteModal = new bootstrap.Modal(els.confirmDeleteModal);

    // 初始化事件监听
    setupEventListeners();
    
    // 初始渲染检查
    renderUI();
});

/* ---------- 事件监听设置 (集中管理) ---------- */
function setupEventListeners() {
    // 登录
    els.loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const email = getEl("email").value, pass = getEl("password").value;
        try {
            await pb.collection("users").authWithPassword(email, pass);
            renderUI();
        } catch (err) {
            showToast("登录失败：" + err.message, 'danger');
        }
    });

    // 退出
    els.logoutBtn.onclick = () => { pb.authStore.clear(); renderUI(); };

    // 确认删除
    els.confirmDeleteBtn.addEventListener('click', handleDelete);

    // 表单提交
    els.invoiceForm.addEventListener("submit", handleSaveInvoice);

    // 搜索与筛选
    els.searchInput.oninput = debounce(() => { state.currentPage = 1; loadInvoices(); }, 300);
    els.statusFilter.onchange = debounce(() => { state.currentPage = 1; loadInvoices(); }, 300);

    // 排序表头点击 (只绑定一次)
    document.querySelectorAll("th[data-sort-by]").forEach(th => {
        th.addEventListener("click", () => {
            const sortBy = th.dataset.sortBy;
            // 切换排序
            state.sortOrder = (state.sortBy === sortBy && state.sortOrder === "desc") ? "asc" : "desc";
            state.sortBy = sortBy;

            // 更新图标UI
            updateSortIcons(th);
            loadInvoices();
        });
    });

    // 每页数量
    els.itemsPerPageSelect.onchange = () => {
        state.itemsPerPage = parseInt(els.itemsPerPageSelect.value);
        state.currentPage = 1;
        loadInvoices();
    };

    // 批量操作
    els.batchDeleteBtn.onclick = confirmBatchDelete;
    els.batchSetStatusBtn.onclick = handleBatchSetStatus;
    els.batchDownloadBtn.onclick = handleBatchDownload;
    els.deselectAllBtn.onclick = deselectAll;
    els.selectAllCheckbox.onchange = handleSelectAll;

    // 新增按钮
    els.addInvoiceBtn.onclick = () => openModal();

    // 识别按钮
    els.recognizeInvoiceNumberBtn.onclick = handleRecognizePDF;
    
    // 键盘快捷键
    document.addEventListener("keydown", handleGlobalKeys);
}

/* ---------- 核心逻辑函数 ---------- */

function renderUI() {
    if (pb.authStore.isValid) {
        els.loginSection.style.display = "none";
        els.mainSection.style.display = "";
        els.logoutBtn.style.display = "";
        els.currentUserSpan.style.display = "";
        
        const model = pb.authStore.model;
        els.currentUserSpan.textContent = model ? model.email : "";
        
        if (model) {
            els.currentAvatarImg.style.display = "";
            if (model.avatar) {
                els.currentAvatarImg.src = pb.files.getURL(model, model.avatar);
            } else {
                const nameEnc = encodeURIComponent(model.email);
                els.currentAvatarImg.src = `https://ui-avatars.com/api/?name=${nameEnc}&background=0D6EFD&color=ffffff&size=64`;
            }
        }

        state.itemsPerPage = parseInt(els.itemsPerPageSelect.value) || 10;
        loadInvoices();
    } else {
        els.loginSection.style.display = "";
        els.mainSection.style.display = "none";
        els.logoutBtn.style.display = "none";
        els.currentUserSpan.style.display = "none";
        els.currentAvatarImg.style.display = "none";
    }
}

async function loadInvoices() {
    showLoader();
    els.invoiceList.innerHTML = "";
    
    // 每次加载清除选中状态，防止操作已消失的数据
    state.selected.clear();
    state.totalAmount = 0;
    updateBatchUI();
    els.selectAllCheckbox.checked = false;

    const filters = [];
    if (els.searchInput.value.trim()) {
        const term = els.searchInput.value.trim();
        filters.push(`invoice_number ~ "${term}" || vendor ~ "${term}" || description ~ "${term}"`);
    }
    if (els.statusFilter.value) filters.push(`status = "${els.statusFilter.value}"`);

    try {
        const result = await pb.collection("invoices").getList(state.currentPage, state.itemsPerPage, {
            sort: `${state.sortOrder === "desc" ? "-" : ""}${state.sortBy}`,
            filter: filters.join(" && "),
            fields: "id,invoice_number,invoice_date,vendor,amount,status,description,attachments"
        });

        result.items.forEach(r => els.invoiceList.appendChild(createInvoiceRow(r)));
        
        els.noInvoicesMessage.style.display = result.items.length === 0 ? "" : "none";
        
        state.currentPage = result.page;
        state.totalPages = result.totalPages;
        renderPagination(result.totalItems);
    } catch (e) {
        if(e.status !== 0) showToast("加载失败：" + e.message, 'danger'); // status 0 usually means aborted
    }
    hideLoader();
}

/* ---------- 表格行渲染 ---------- */
const statusMap = {
    pending_application: "待申请",
    in_invoicing: "开票中",
    in_reimbursement: "报销中",
    reimbursed: "已报销",
};
const statusColor = s => ({ pending_application: "secondary", in_invoicing: "warning", in_reimbursement: "primary", reimbursed: "success" }[s] || "secondary");

function createInvoiceRow(rec) {
    const tr = document.createElement("tr");
    tr.className = `invoice-row ${state.selected.has(rec.id) ? "selected" : ""}`;
    tr.dataset.id = rec.id;
    tr.dataset.amount = rec.amount;

    tr.innerHTML = `
    <td><input type="checkbox" class="row-select-checkbox" ${state.selected.has(rec.id) ? "checked" : ""}></td>
    <td class="user-select-all">${rec.invoice_number}</td>
    <td>${rec.invoice_date ? rec.invoice_date.slice(0, 10) : '-'}</td>
    <td>${rec.vendor}</td>
    <td>¥${Number(rec.amount).toFixed(2)}</td>
    <td><span class="badge bg-${statusColor(rec.status)}">${statusMap[rec.status] || rec.status}</span></td>
    <td class="text-truncate" style="max-width: 150px;" title="${rec.description || ''}">${rec.description || "-"}</td>
    <td>${(rec.attachments || []).length === 0 ? "无" : (rec.attachments || []).map((_, i) => `<i class="bi bi-file-earmark-pdf-fill text-danger me-1" title="附件${i + 1}"></i>`).join("")}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary me-2 edit-btn" title="编辑"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-outline-danger delete-btn" title="删除"><i class="bi bi-trash"></i></button>
    </td>`;

    // 事件委托处理稍微麻烦，这里直接绑定也行，但注意 stopPropagation
    const checkbox = tr.querySelector(".row-select-checkbox");
    
    // 点击行（除按钮外）切换选中
    tr.onclick = (e) => {
        // 如果点击的是链接或输入框，不触发行选中
        if(['INPUT', 'BUTTON', 'A', 'I'].includes(e.target.tagName)) return;
        toggleSelect(rec.id, tr, checkbox); 
    };
    
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleSelect(rec.id, tr, checkbox);
    };

    tr.querySelector(".edit-btn").onclick = (e) => { e.stopPropagation(); openModal(rec); };
    tr.querySelector(".delete-btn").onclick = (e) => { e.stopPropagation(); confirmSingleDelete(rec.id); };

    return tr;
}

/* ---------- 选中逻辑 ---------- */
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
    updateBatchUI();
    checkSelectAllStatus();
}

function updateBatchUI() {
    const count = state.selected.size;
    const batchActionsEl = els.batchActions;

    // 🚨 增强检查：如果关键元素不存在，立即返回
    if (!batchActionsEl || !els.totalAmountValue || !els.selectedCount) {
        // console.warn("批量操作相关DOM元素缺失 (ID: batchActions, totalAmountValue, selectedCount)");
        return;
    }
    
    // 更新数值
    if (count === 0) state.totalAmount = 0;
    els.totalAmountValue.textContent = state.totalAmount.toFixed(2);
    els.selectedCount.textContent = String(count);

    // 优化显隐逻辑
    if (count > 0) {
        batchActionsEl.style.display = "flex"; 
        setTimeout(() => batchActionsEl.classList.add("show"), 10);
    } else {
        batchActionsEl.classList.remove("show");
        setTimeout(() => {
            if(!batchActionsEl.classList.contains("show")) {
                batchActionsEl.style.display = "none";
            }
        }, 300);
    }
}

function checkSelectAllStatus() {
    const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
    if(allCheckboxes.length === 0) {
        els.selectAllCheckbox.checked = false;
        return;
    }
    els.selectAllCheckbox.checked = Array.from(allCheckboxes).every(cb => cb.checked);
}

/* ---------- 新增 / 编辑 ---------- */
async function openModal(rec) {
    els.invoiceForm.reset();
    els.attachments.value = ''; // 简单清空文件输入
    
    els.invoiceId.value = rec ? rec.id : "";
    state.currentAttachments = rec && rec.attachments ? [...rec.attachments] : [];
    els.attachmentPreview.innerHTML = "";
    els.modalTitle.textContent = rec ? "编辑发票" : "添加发票";

    if (rec) {
        // 获取完整的记录对象，确保包含所有字段用于生成文件URL
        try {
            state.currentRecord = await pb.collection("invoices").getOne(rec.id);
        } catch (e) {
            console.error("获取完整记录失败：", e);
            state.currentRecord = rec; // 降级处理：使用不完整的记录
        }
        
        els.invoiceNumber.value = rec.invoice_number;
        els.invoiceDate.value = rec.invoice_date ? rec.invoice_date.slice(0, 10) : "";
        els.vendor.value = rec.vendor;
        els.amount.value = rec.amount;
        els.status.value = rec.status;
        els.description.value = rec.description || "";
        renderAttachmentPreview();
    } else {
        state.currentRecord = null;
    }
    bsInvoiceModal.show();
}

/* ---------- PDF 识别 (优化版) ---------- */
async function handleRecognizePDF() {
    const files = els.attachments.files;
    if (files.length === 0) return showToast("请先选择 PDF 文件！", 'warning');
    
    const btn = els.recognizeInvoiceNumberBtn;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 识别中...`;

    try {
        const file = files[0]; // 目前只处理第一个
        if (file.type !== "application/pdf") throw new Error("必须是 PDF 文件");

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: './cmaps/',
            cMapPacked: true,
        }).promise;

        let fullText = "";
        // 只读取前3页，通常发票信息在第一页
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(""); // 移除空格以优化正则匹配
        }
        
        console.log("Raw PDF Text:", fullText);

        // 1. 识别金额 (优化：优先匹配 "小写" 附近的数字，其次匹配大写转换)
        let recognizedAmount = null;
        
        // 匹配：小写 123.45 或 ￥123.45
        const amountNumRegex = /(?:小写|金额|计)\D{0,5}?([¥￥]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/;
        const numMatch = fullText.match(amountNumRegex);
        
        if (numMatch) {
            recognizedAmount = parseFloat(numMatch[1].replace(/[¥￥,\s]/g, ''));
        } 
        
        // 如果没找到数字，尝试大写 (简单版，使用你原有的 helper)
        if (!recognizedAmount) {
            const chineseAmountRegex = /([零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元角分整]{4,})/;
            const cnMatch = fullText.match(chineseAmountRegex);
            if (cnMatch) recognizedAmount = convertChineseToNumber(cnMatch[1]);
        }

        if (recognizedAmount) els.amount.value = recognizedAmount.toFixed(2);

        // 2. 识别发票号码 (优化：8-20位数字，通常在"发票号码"关键字附近，或者独立的连续长数字)
        // 移除所有空白符后再匹配
        const cleanText = fullText.replace(/\s+/g, "");
        // 优先级1：关键字后
        const invoiceNumRegex = /(?:发票号码|No\.|NO\.)[:：]?(\d{8,20})/;
        const numMatchInv = cleanText.match(invoiceNumRegex);
        
        if (numMatchInv) {
            els.invoiceNumber.value = numMatchInv[1];
        } else {
            // 优先级2：独立的10/12/20位数字（需谨慎，防止匹配到税号）
            // 简单策略：找最长的数字串，通常税号是15-20位，发票号也类似，这步比较这就模糊
            // 这里保留原有的 20位全电发票逻辑，并放宽到 8位
            const looseMatch = cleanText.match(/\d{20}/) || cleanText.match(/\d{10,12}/);
            if(looseMatch) els.invoiceNumber.value = looseMatch[0];
        }

        // 3. 识别日期 (YYYY年MM月DD日 或 YYYY-MM-DD)
        const dateRegex = /(\d{4})[.\-年](\d{1,2})[.\-月](\d{1,2})/;
        const dateMatch = cleanText.match(dateRegex);
        if(dateMatch) {
            // 格式化为 YYYY-MM-DD
            const year = dateMatch[1];
            const month = dateMatch[2].padStart(2, '0');
            const day = dateMatch[3].padStart(2, '0');
            els.invoiceDate.value = `${year}-${month}-${day}`;
            // Flatpickr 更新
            els.invoiceDate._flatpickr.setDate(`${year}-${month}-${day}`);
        }

        showToast("识别完成，请核对信息", 'success');

    } catch (error) {
        console.error(error);
        showToast("识别失败: " + error.message, 'warning');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* ---------- 保存逻辑 ---------- */
async function handleSaveInvoice(e) {
    e.preventDefault();
    try {
        const id = els.invoiceId.value;
        const fd = new FormData(els.invoiceForm);
        fd.append("user", pb.authStore.model.id);

        if (id) {
            // 处理附件：PocketBase 不支持直接 "保留部分，删除部分" 的简单 API
            // 必须明确列出所有要保留的旧文件 (作为 'attachments' 传递) 和要删除的 (如果支持)
            // 但 PocketBase SDK 的 FormData 更新比较特殊。
            // 简单策略：只追加新文件。如果用户在 UI 删除了旧文件，我们需要调用 API 单独删除，或者后端处理。
            
            // 注意：FormData 更新模式下，PocketBase 会追加新文件到列表。
            // 如果要删除旧文件，通常需要单独调用 collection.update(id, { "attachments-": ["filename"] })
            // 或者在 FormData 中使用特殊 key，但这依赖于 JS SDK 版本。
            // 这里的实现维持你原有的逻辑，但稍作清理：
            
            // 1. 找出被用户在 UI 上移除的旧附件
            const originalRec = state.currentRecord;
            if(originalRec && originalRec.attachments) {
                const toRemove = originalRec.attachments.filter(f => !state.currentAttachments.includes(f));
                toRemove.forEach(f => fd.append("attachments-", f)); // PocketBase 语法: 删除特定文件
            }
            
            // 2. 清理 fd 中的 attachments 字段，防止重复提交旧文件名作为字符串（这会导致错误）
            fd.delete("attachments"); 
            
            // 3. 添加新上传的文件
            if (els.attachments.files.length > 0) {
                 for (const file of els.attachments.files) {
                    fd.append("attachments", file); // 追加新文件
                }
            }

            await pb.collection("invoices").update(id, fd);
            showToast("更新成功", 'success');
        } else {
            await pb.collection("invoices").create(fd);
            showToast("创建成功", 'success');
        }

        bsInvoiceModal.hide();
        loadInvoices();
    } catch (e) {
        showToast("保存失败：" + e.message, 'danger');
    }
}

/* ---------- 删除逻辑 ---------- */
function confirmSingleDelete(id) {
    els.confirmDeleteBtn.dataset.deleteId = id;
    els.confirmDeleteBtn.dataset.deleteType = 'single';
    bsConfirmDeleteModal.show();
}

function confirmBatchDelete() {
    if (!state.selected.size) return showToast("请选择发票", 'warning');
    els.confirmDeleteBtn.dataset.deleteType = 'batch';
    bsConfirmDeleteModal.show();
}

async function handleDelete() {
    const type = els.confirmDeleteBtn.dataset.deleteType;
    showLoader();
    try {
        if (type === 'single') {
            await pb.collection("invoices").delete(els.confirmDeleteBtn.dataset.deleteId);
        } else {
            await Promise.all([...state.selected].map(id => pb.collection("invoices").delete(id)));
            deselectAll();
        }
        showToast("删除成功", 'success');
        bsConfirmDeleteModal.hide();
        loadInvoices();
    } catch (e) {
        showToast("删除失败：" + e.message, 'danger');
    }
    hideLoader();
}

/* ---------- 批量设置状态 ---------- */
async function handleBatchSetStatus() {
    const newStatus = els.batchStatusSelect.value;
    if (!newStatus) return showToast("请选择状态", 'warning');
    if (!state.selected.size) return;

    showLoader();
    try {
        await Promise.all([...state.selected].map(id =>
            pb.collection("invoices").update(id, { status: newStatus })
        ));
        deselectAll();
        loadInvoices();
        els.batchStatusSelect.value = "";
        showToast("批量更新成功", 'success');
    } catch (e) {
        showToast("操作失败：" + e.message, 'danger');
    }
    hideLoader();
}

/* ---------- 批量下载 ---------- */
async function handleBatchDownload() {
    if (!state.selected.size) return;
    showLoader();
    
    try {
        const zip = new JSZip();
        const invoicesData = [];
        
        // 并发请求获取详情
        const promises = [...state.selected].map(async id => {
            const rec = await pb.collection("invoices").getOne(id);
            
            // CSV 数据准备
            invoicesData.push({
                "发票号码": rec.invoice_number,
                "日期": rec.invoice_date ? rec.invoice_date.slice(0, 10) : '',
                "供应商": rec.vendor,
                "金额": rec.amount,
                "状态": statusMap[rec.status] || rec.status,
                "描述": rec.description
            });

            // 附件下载
            if(rec.attachments && rec.attachments.length) {
                for(let i=0; i<rec.attachments.length; i++) {
                    const filename = rec.attachments[i];
                    const ext = filename.split('.').pop();
                    const fileUrl = pb.files.getURL(rec, filename);
                    // Fetch blob
                    const blob = await fetch(fileUrl).then(r => r.blob());
                    zip.file(`${rec.invoice_number}_${i+1}.${ext}`, blob);
                }
            }
        });

        await Promise.all(promises);

        // 生成 CSV
        if (invoicesData.length > 0) {
            const headers = Object.keys(invoicesData[0]);
            const csvRows = [
                headers.join(','),
                ...invoicesData.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
            ];
            // 添加 BOM
            zip.file("invoice_list.csv", "\ufeff" + csvRows.join('\n'));
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Invoices_Export_${new Date().toISOString().slice(0,10)}.zip`);

    } catch(e) {
        showToast("下载出错: " + e.message, 'danger');
    }
    
    hideLoader();
}


/* ---------- 辅助函数 ---------- */
function renderAttachmentPreview() {
    const container = els.attachmentPreview;
    container.innerHTML = "";
    
    if (state.currentAttachments.length === 0) {
        container.innerHTML = "<small class='text-muted'>无已有附件</small>";
        return;
    }

    state.currentAttachments.forEach(f => {
        const div = document.createElement("div");
        div.className = "d-flex align-items-center mb-1 bg-light p-1 rounded";
        
        // 创建链接元素
        const link = document.createElement("a");
        const fileUrl = pb.files.getURL(state.currentRecord, f);
        link.href = fileUrl;
        link.target = "_blank";
        link.className = "text-decoration-none text-truncate me-auto";
        link.style.maxWidth = "300px";
        link.style.pointerEvents = "auto";
        link.textContent = f;
        
        // 创建图标
        const icon = document.createElement("i");
        icon.className = "bi bi-paperclip me-2 text-secondary";
        
        // 创建删除按钮
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-sm text-danger ms-2";
        deleteBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        deleteBtn.style.pointerEvents = "auto";
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.currentAttachments = state.currentAttachments.filter(item => item !== f);
            renderAttachmentPreview();
        };
        
        // 组装元素
        div.appendChild(icon);
        div.appendChild(link);
        div.appendChild(deleteBtn);
        
        container.appendChild(div);
    });
}

function updateSortIcons(clickedTh) {
    document.querySelectorAll("th[data-sort-by] i").forEach(icon => {
        icon.className = "bi bi-sort-alpha-down opacity-50"; // 默认样式
    });
    const icon = clickedTh.querySelector("i");
    if (icon) {
        icon.className = state.sortOrder === "asc" ? "bi bi-sort-alpha-down" : "bi bi-sort-alpha-up";
        icon.classList.remove("opacity-50");
    }
}

function renderPagination(totalItems) {
    const p = els.pagination;
    p.innerHTML = "";
    
    if (totalItems === 0) {
        els.paginationControls.style.display = "none";
        return;
    }
    els.paginationControls.style.display = "flex";
    
    const createPageItem = (page, text, isActive = false, isDisabled = false) => {
        const li = document.createElement("li");
        li.className = `page-item ${isActive ? "active" : ""} ${isDisabled ? "disabled" : ""}`;
        li.innerHTML = `<a class="page-link" href="#">${text}</a>`;
        if (!isDisabled && !isActive) {
            li.onclick = (e) => { e.preventDefault(); state.currentPage = page; loadInvoices(); };
        }
        return li;
    };

    // Prev
    p.appendChild(createPageItem(state.currentPage - 1, "&laquo;", false, state.currentPage === 1));

    // Pages (简单逻辑：显示当前及前后)
    let start = Math.max(1, state.currentPage - 2);
    let end = Math.min(state.totalPages, state.currentPage + 2);

    if(start > 1) p.appendChild(createPageItem(1, "1"));
    if(start > 2) p.appendChild(createPageItem(0, "...", false, true));

    for (let i = start; i <= end; i++) {
        p.appendChild(createPageItem(i, i, i === state.currentPage));
    }

    if(end < state.totalPages - 1) p.appendChild(createPageItem(0, "...", false, true));
    if(end < state.totalPages) p.appendChild(createPageItem(state.totalPages, state.totalPages));

    // Next
    p.appendChild(createPageItem(state.currentPage + 1, "&raquo;", false, state.currentPage === state.totalPages));
}

function deselectAll() {
    state.selected.clear();
    document.querySelectorAll(".invoice-row.selected").forEach(c => c.classList.remove("selected"));
    document.querySelectorAll(".row-select-checkbox").forEach(c => c.checked = false);
    state.totalAmount = 0;
    updateBatchUI();
    els.selectAllCheckbox.checked = false;
}

function handleSelectAll() {
    const isChecked = els.selectAllCheckbox.checked;
    const rows = document.querySelectorAll(".invoice-row");
    
    rows.forEach(row => {
        const id = row.dataset.id;
        const checkbox = row.querySelector(".row-select-checkbox");
        const amount = Number(row.dataset.amount);

        if (isChecked) {
            if (!state.selected.has(id)) {
                state.selected.add(id);
                row.classList.add("selected");
                checkbox.checked = true;
                state.totalAmount += amount;
            }
        } else {
             if (state.selected.has(id)) {
                state.selected.delete(id);
                row.classList.remove("selected");
                checkbox.checked = false;
                state.totalAmount -= amount;
            }
        }
    });
    updateBatchUI();
}

function handleGlobalKeys(e) {
    // 1. 如果模态框打开，停止处理全局快捷键
    const modal = document.getElementById('invoiceModal');
    if (modal && modal.classList.contains('show')) return;

    // 2. Ctrl + A 处理
    if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
        if(allCheckboxes.length === 0) return;
        
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        if (allChecked) {
            deselectAll();
        } else {
            els.selectAllCheckbox.checked = true;
            handleSelectAll();
        }
    }

    // 3. Ctrl + F 处理
    if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        els.searchInput.focus();
    }
    
    // 4. ESC 处理
    if (e.key === "Escape") {
        deselectAll();
    }
}

function showLoader() { els.loading.style.display = ""; }
function hideLoader() { els.loading.style.display = "none"; }

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    if (!container) return;

    // 简单的防抖，防止同类消息刷屏 (可选)
    
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

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// 初始化日期控件
flatpickr("#invoiceDate", {
    dateFormat: "Y-m-d",
    locale: flatpickr.l10ns.zh,
    allowInput: true 
});

// 中文数字转数字 Helper (保持原样，功能正常)
function convertChineseToNumber(chineseStr) {
   // ... 保持你原来的代码 ...
   // 篇幅原因，这里假设你原来的 convertChineseToNumber 函数逻辑没问题，请保留原来的实现。
   // 为了代码完整性，如果需要我也可以贴出来，但逻辑未变。
   const chineseNumMap = { '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9 };
  const chineseUnitMap = { '拾': 10, '佰': 100, '仟': 1000, '万': 10000, '亿': 100000000 };
  let result = 0, tempNum = 0, section = 0, decimalPart = 0;
  
  // 预处理：去掉“整”字等
  let cleanStr = chineseStr.replace(/整$/, ''); 
  // 分离元角分
  let [integerStr, decimalStr] = cleanStr.split(/[圆元]/);
  if(!decimalStr && (cleanStr.indexOf('角')>-1 || cleanStr.indexOf('分')>-1)) {
      // 处理没有元，只有角分的情况 (虽然发票少见)
      integerStr = ""; decimalStr = cleanStr;
  }
  
  if (decimalStr) {
      let val = 0;
      for(let char of decimalStr) {
          if(chineseNumMap[char] !== undefined) val = chineseNumMap[char];
          else if(char === '角') { decimalPart += val * 0.1; val=0; }
          else if(char === '分') { decimalPart += val * 0.01; val=0; }
      }
  }

  if (integerStr) {
      for(let char of integerStr) {
          if(chineseNumMap[char] !== undefined) tempNum = chineseNumMap[char];
          else if(chineseUnitMap[char] !== undefined) {
              if(char === '万' || char === '亿') {
                  section = (section + tempNum) * chineseUnitMap[char];
                  result += section; section = 0; tempNum = 0;
              } else {
                  section += tempNum * chineseUnitMap[char];
                  tempNum = 0;
              }
          }
      }
      result += section + tempNum;
  }
  return result + decimalPart;
}
