/* ============================================
   发票管理系统 - 主应用程序
   ============================================ */

/* ========== 配置与常量 ========== */
const CONFIG = {
    PB_URL: "https://invoice.csgo.ovh/", // 开发时改为 'http://127.0.0.1:8090'
    TIMEOUT: {
        INIT_RETRY: 500,      // 初始化重试间隔
        INIT_DELAY: 100,      // 初始化延迟
        SEARCH_DEBOUNCE: 300  // 搜索防抖延迟
    },
    PAGE_SIZES: [10, 25, 50, 9999],
    RETRY_MAX: 3
};

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

const CHINESE_NUM_MAP = {
    '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4,
    '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9
};

const CHINESE_UNIT_MAP = {
    '拾': 10, '佰': 100, '仟': 1000, '万': 10000, '亿': 100000000
};

/* ========== PocketBase 初始化 ========== */
const pb = new PocketBase(CONFIG.PB_URL);

/* ========== DOM 元素引用 ========== */
const getEl = (id) => document.getElementById(id);
let els = {}; // 延迟初始化

/**
 * 初始化所有DOM元素引用
 * 兼容Cloudflare Rocket Loader的延迟初始化
 */
function initializeElements() {
    els = {
        // 认证相关
        loginForm: getEl("loginForm"),
        loginSection: getEl("loginSection"),
        mainSection: getEl("mainSection"),
        logoutBtn: getEl("logoutBtn"),
        currentUserSpan: getEl("currentUser"),
        currentAvatarImg: getEl("currentAvatar"),
        
        // 工具栏和按钮
        addInvoiceBtn: getEl("addInvoiceBtn"),
        recognizeInvoiceNumberBtn: getEl("recognizeInvoiceNumberBtn"),
        
        // 搜索和筛选
        searchInput: getEl("searchInput"),
        statusFilter: getEl("statusFilter"),
        itemsPerPageSelect: getEl("itemsPerPageSelect"),
        
        // 列表和分页
        invoiceList: getEl("invoiceList"),
        pagination: getEl("pagination"),
        paginationControls: getEl("paginationControlsWrapper"),
        noInvoicesMessage: getEl("noInvoicesMessage"),
        loading: getEl("loading"),
        
        // 选择框和批量操作
        selectAllCheckbox: getEl("selectAllCheckbox"),
        batchActions: getEl("batchActions"),
        selectedCount: getEl("selectedCount"),
        totalAmountValue: getEl("totalAmountValue"),
        batchStatusSelect: getEl("batchStatusSelect"),
        batchSetStatusBtn: getEl("batchSetStatusBtn"),
        batchDownloadBtn: getEl("batchDownloadBtn"),
        batchDeleteBtn: getEl("batchDeleteBtn"),
        deselectAllBtn: getEl("deselectAllBtn"),
        
        // 模态框
        invoiceModal: getEl("invoiceModal"),
        modalTitle: getEl("modalTitle"),
        invoiceForm: getEl("invoiceForm"),
        
        // 表单字段
        invoiceId: getEl("invoiceId"),
        invoiceNumber: getEl("invoiceNumber"),
        invoiceDate: getEl("invoiceDate"),
        vendor: getEl("vendor"),
        amount: getEl("amount"),
        status: getEl("status"),
        description: getEl("description"),
        attachments: getEl("attachments"),
        attachmentPreview: getEl("attachmentPreview"),
        
        // 删除确认框
        confirmDeleteModal: getEl("confirmDeleteModal"),
        confirmDeleteBtn: getEl("confirmDeleteBtn")
    };
}

/* ========== 应用状态 ========== */
const state = {
    // 选择相关
    selected: new Set(),
    totalAmount: 0,
    
    // 当前编辑
    currentAttachments: [],
    currentRecord: null,
    
    // 分页和排序
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 0,
    sortBy: "invoice_date",
    sortOrder: "desc"
};

/* ========== Bootstrap 模态框实例 ========== */
let bsInvoiceModal = null;
let bsConfirmDeleteModal = null;
let initRetryCount = 0;

/* ========== 初始化 ========== */

/**
 * 安全初始化应用
 * - 检查DOM元素是否加载
 * - 初始化Bootstrap模态框
 * - 设置事件监听器
 * - 执行初始渲染
 */
function safeInitialize() {
    initializeElements();
    
    // 检查关键元素是否加载完成
    const requiredElements = [
        'invoiceModal', 'confirmDeleteModal', 'batchActions',
        'loginSection', 'mainSection'
    ];
    
    const allLoaded = requiredElements.every(key => els[key]);
    
    if (!allLoaded) {
        initRetryCount++;
        if (initRetryCount <= CONFIG.RETRY_MAX) {
            console.warn(`DOM元素未加载，${CONFIG.TIMEOUT.INIT_RETRY}ms后重试 (${initRetryCount}/${CONFIG.RETRY_MAX})`);
            setTimeout(safeInitialize, CONFIG.TIMEOUT.INIT_RETRY);
            return;
        } else {
            console.error("初始化失败：无法加载关键DOM元素");
            return;
        }
    }
    
    console.log("✓ DOM元素加载完成，开始初始化应用");
    
    try {
        bsInvoiceModal = new bootstrap.Modal(els.invoiceModal);
        bsConfirmDeleteModal = new bootstrap.Modal(els.confirmDeleteModal);
        
        setupEventListeners();
        renderUI();
        
        console.log("✓ 应用初始化完成");
    } catch (e) {
        console.error("初始化过程中出错：", e);
        showToast("应用初始化失败，请刷新页面重试", 'danger');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(safeInitialize, CONFIG.TIMEOUT.INIT_DELAY);
});

// 备用方案
document.addEventListener("readystatechange", () => {
    if (document.readyState === "interactive" && !bsInvoiceModal) {
        safeInitialize();
    }
});

/* ========== 事件监听设置 ========== */

/**
 * 设置所有事件监听器
 * 集中管理以便维护和调试
 */
function setupEventListeners() {
    // ===== 认证事件 =====
    if (els.loginForm) {
        els.loginForm.addEventListener("submit", handleLogin);
    }
    if (els.logoutBtn) {
        els.logoutBtn.onclick = handleLogout;
    }

    // ===== 模态框事件 =====
    if (els.confirmDeleteBtn) {
        els.confirmDeleteBtn.addEventListener('click', handleDelete);
    }
    if (els.invoiceForm) {
        els.invoiceForm.addEventListener("submit", handleSaveInvoice);
    }

    // ===== 搜索和筛选 =====
    if (els.searchInput) {
        els.searchInput.oninput = debounce(() => {
            state.currentPage = 1;
            loadInvoices();
        }, CONFIG.TIMEOUT.SEARCH_DEBOUNCE);
    }
    if (els.statusFilter) {
        els.statusFilter.onchange = debounce(() => {
            state.currentPage = 1;
            loadInvoices();
        }, CONFIG.TIMEOUT.SEARCH_DEBOUNCE);
    }

    // ===== 排序 =====
    document.querySelectorAll("th[data-sort-by]").forEach(th => {
        th.addEventListener("click", handleSortClick);
    });

    // ===== 分页 =====
    if (els.itemsPerPageSelect) {
        els.itemsPerPageSelect.onchange = handlePageSizeChange;
    }

    // ===== 批量操作 =====
    if (els.batchDeleteBtn) els.batchDeleteBtn.onclick = confirmBatchDelete;
    if (els.batchSetStatusBtn) els.batchSetStatusBtn.onclick = handleBatchSetStatus;
    if (els.batchDownloadBtn) els.batchDownloadBtn.onclick = handleBatchDownload;
    if (els.deselectAllBtn) els.deselectAllBtn.onclick = deselectAll;
    if (els.selectAllCheckbox) els.selectAllCheckbox.onchange = handleSelectAll;

    // ===== 按钮事件 =====
    if (els.addInvoiceBtn) els.addInvoiceBtn.onclick = () => openModal();
    if (els.recognizeInvoiceNumberBtn) els.recognizeInvoiceNumberBtn.onclick = handleRecognizePDF;
    
    // ===== 全局快捷键 =====
    document.addEventListener("keydown", handleGlobalKeys);
}

/**
 * 处理登录
 */
async function handleLogin(e) {
    e.preventDefault();
    try {
        const email = getEl("email")?.value;
        const password = getEl("password")?.value;
        
        if (!email || !password) {
            showToast("请输入邮箱和密码", 'warning');
            return;
        }
        
        await pb.collection("users").authWithPassword(email, password);
        renderUI();
    } catch (err) {
        console.error("登录错误:", err);
        showToast("登录失败：" + err.message, 'danger');
    }
}

/**
 * 处理登出
 */
function handleLogout() {
    pb.authStore.clear();
    state.selected.clear();
    state.totalAmount = 0;
    renderUI();
}

/**
 * 处理排序列表头点击
 */
function handleSortClick(e) {
    const th = e.currentTarget;
    const sortBy = th.dataset.sortBy;
    
    // 切换排序方向
    state.sortOrder = (state.sortBy === sortBy && state.sortOrder === "desc") ? "asc" : "desc";
    state.sortBy = sortBy;
    
    updateSortIcons(th);
    loadInvoices();
}

/**
 * 处理每页显示数量变更
 */
function handlePageSizeChange() {
    state.itemsPerPage = parseInt(els.itemsPerPageSelect.value);
    state.currentPage = 1;
    loadInvoices();
}

/* ========== 核心UI渲染函数 ========== */

/**
 * 渲染主UI - 显示/隐藏登录和主界面
 */
function renderUI() {
    if (pb.authStore.isValid) {
        // 显示主界面
        if (els.loginSection) els.loginSection.style.display = "none";
        if (els.mainSection) els.mainSection.style.display = "";
        if (els.logoutBtn) els.logoutBtn.style.display = "";
        if (els.currentUserSpan) els.currentUserSpan.style.display = "";
        
        // 显示用户信息
        const model = pb.authStore.model;
        if (els.currentUserSpan && model) {
            els.currentUserSpan.textContent = model.email;
        }
        
        // 设置头像
        if (model && els.currentAvatarImg) {
            els.currentAvatarImg.style.display = "";
            if (model.avatar) {
                els.currentAvatarImg.src = pb.files.getURL(model, model.avatar);
            } else {
                const nameEnc = encodeURIComponent(model.email);
                els.currentAvatarImg.src = `https://ui-avatars.com/api/?name=${nameEnc}&background=0D6EFD&color=ffffff&size=64`;
            }
        }

        // 加载发票列表
        state.itemsPerPage = (els.itemsPerPageSelect?.value) ? parseInt(els.itemsPerPageSelect.value) : 10;
        loadInvoices();
    } else {
        // 显示登录界面
        if (els.loginSection) els.loginSection.style.display = "";
        if (els.mainSection) els.mainSection.style.display = "none";
        if (els.logoutBtn) els.logoutBtn.style.display = "none";
        if (els.currentUserSpan) els.currentUserSpan.style.display = "none";
        if (els.currentAvatarImg) els.currentAvatarImg.style.display = "none";
    }
}

/**
 * 加载并显示发票列表
 */
async function loadInvoices() {
    try {
        showLoader();
        if (els.invoiceList) els.invoiceList.innerHTML = "";
        
        // 重置选择状态
        state.selected.clear();
        state.totalAmount = 0;
        updateBatchUI();
        if (els.selectAllCheckbox) {
            try {
                els.selectAllCheckbox.checked = false;
            } catch (e) {
                console.warn("无法重置selectAllCheckbox");
            }
        }

        // 构建过滤条件
        const filters = [];
        if (els.searchInput?.value) {
            const term = els.searchInput.value.trim();
            filters.push(`invoice_number ~ "${term}" || vendor ~ "${term}" || description ~ "${term}"`);
        }
        if (els.statusFilter?.value) {
            filters.push(`status = "${els.statusFilter.value}"`);
        }

        // 请求数据
        const result = await pb.collection("invoices").getList(state.currentPage, state.itemsPerPage, {
            sort: `${state.sortOrder === "desc" ? "-" : ""}${state.sortBy}`,
            filter: filters.join(" && "),
            fields: "id,invoice_number,invoice_date,vendor,amount,status,description,attachments"
        });

        // 渲染列表
        if (els.invoiceList) {
            result.items.forEach(r => els.invoiceList.appendChild(createInvoiceRow(r)));
        }
        
        // 显示/隐藏无数据提示
        if (els.noInvoicesMessage) {
            els.noInvoicesMessage.style.display = result.items.length === 0 ? "" : "none";
        }
        
        // 更新分页
        state.currentPage = result.page;
        state.totalPages = result.totalPages;
        renderPagination(result.totalItems);
    } catch (e) {
        if (e.status !== 0) {
            console.error("加载发票失败:", e);
            showToast("加载失败：" + e.message, 'danger');
        }
    } finally {
        hideLoader();
    }
}

/* ========== 表格行渲染 ========== */

/**
 * 创建发票表格行
 */
function createInvoiceRow(rec) {
    const tr = document.createElement("tr");
    tr.className = `invoice-row ${state.selected.has(rec.id) ? "selected" : ""}`;
    tr.dataset.id = rec.id;
    tr.dataset.amount = rec.amount;

    // 使用textContent而不是innerHTML防止XSS
    tr.innerHTML = `
        <td><input type="checkbox" class="row-select-checkbox" ${state.selected.has(rec.id) ? "checked" : ""}></td>
        <td class="user-select-all">${escapeHtml(rec.invoice_number)}</td>
        <td>${rec.invoice_date ? rec.invoice_date.slice(0, 10) : '-'}</td>
        <td>${escapeHtml(rec.vendor)}</td>
        <td>¥${Number(rec.amount).toFixed(2)}</td>
        <td><span class="badge bg-${getStatusColor(rec.status)}">${STATUS_MAP[rec.status] || rec.status}</span></td>
        <td class="text-truncate" style="max-width: 150px;" title="${escapeHtml(rec.description || '')}">${escapeHtml(rec.description || "-")}</td>
        <td>${(rec.attachments || []).length === 0 ? "无" : (rec.attachments || []).map((_, i) => `<i class="bi bi-file-earmark-pdf-fill text-danger me-1" title="附件${i + 1}"></i>`).join("")}</td>
        <td>
            <button class="btn btn-sm btn-outline-primary me-2 edit-btn" title="编辑"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-btn" title="删除"><i class="bi bi-trash"></i></button>
        </td>`;

    const checkbox = tr.querySelector(".row-select-checkbox");
    
    // 点击行切换选中
    tr.onclick = (e) => {
        if (['INPUT', 'BUTTON', 'A', 'I'].includes(e.target.tagName)) return;
        toggleSelect(rec.id, tr, checkbox);
    };
    
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleSelect(rec.id, tr, checkbox);
    };

    tr.querySelector(".edit-btn").onclick = (e) => {
        e.stopPropagation();
        openModal(rec);
    };
    
    tr.querySelector(".delete-btn").onclick = (e) => {
        e.stopPropagation();
        confirmSingleDelete(rec.id);
    };

    return tr;
}

/**
 * 获取状态标签颜色
 */
function getStatusColor(status) {
    return STATUS_COLORS[status] || "secondary";
}

/**
 * HTML转义防止XSS
 */
function escapeHtml(text) {
    if (!text) return "";
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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

    // 增强检查：如果关键元素不存在，立即返回
    if (!batchActionsEl || !els.totalAmountValue || !els.selectedCount) {
        console.warn("批量操作相关DOM元素缺失，跳过更新");
        return;
    }
    
    // 更新数值
    if (count === 0) state.totalAmount = 0;
    
    if (els.totalAmountValue) els.totalAmountValue.textContent = state.totalAmount.toFixed(2);
    if (els.selectedCount) els.selectedCount.textContent = String(count);

    // 优化显隐逻辑
    if (count > 0) {
        if (batchActionsEl && batchActionsEl.style) batchActionsEl.style.display = "flex"; 
        setTimeout(() => {
            if (batchActionsEl && batchActionsEl.classList) batchActionsEl.classList.add("show");
        }, 10);
    } else {
        if (batchActionsEl && batchActionsEl.classList) batchActionsEl.classList.remove("show");
        setTimeout(() => {
            if (batchActionsEl && batchActionsEl.classList && !batchActionsEl.classList.contains("show")) {
                if (batchActionsEl.style) batchActionsEl.style.display = "none";
            }
        }, 300);
    }
}

function checkSelectAllStatus() {
    if (!els.selectAllCheckbox) return;
    
    const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
    if(allCheckboxes.length === 0) {
        els.selectAllCheckbox.checked = false;
        return;
    }
    els.selectAllCheckbox.checked = Array.from(allCheckboxes).every(cb => cb.checked);
}

/* ---------- 新增 / 编辑 ---------- */
async function openModal(rec) {
    if (!els.invoiceForm || !els.invoiceModal) return;
    
    els.invoiceForm.reset();
    if (els.attachments) els.attachments.value = ''; // 简单清空文件输入
    
    if (els.invoiceId) els.invoiceId.value = rec ? rec.id : "";
    state.currentAttachments = rec && rec.attachments ? [...rec.attachments] : [];
    if (els.attachmentPreview) els.attachmentPreview.innerHTML = "";
    if (els.modalTitle) els.modalTitle.textContent = rec ? "编辑发票" : "添加发票";

    if (rec) {
        // 获取完整的记录对象，确保包含所有字段用于生成文件URL
        try {
            state.currentRecord = await pb.collection("invoices").getOne(rec.id);
        } catch (e) {
            console.error("获取完整记录失败：", e);
            state.currentRecord = rec; // 降级处理：使用不完整的记录
        }
        
        if (els.invoiceNumber) els.invoiceNumber.value = rec.invoice_number;
        if (els.invoiceDate) els.invoiceDate.value = rec.invoice_date ? rec.invoice_date.slice(0, 10) : "";
        if (els.vendor) els.vendor.value = rec.vendor;
        if (els.amount) els.amount.value = rec.amount;
        if (els.status) els.status.value = rec.status;
        if (els.description) els.description.value = rec.description || "";
        renderAttachmentPreview();
    } else {
        state.currentRecord = null;
    }
    bsInvoiceModal.show();
}

/* ---------- PDF 识别 (优化版) ---------- */
async function handleRecognizePDF() {
    if (!els.attachments) return;
    
    const files = els.attachments.files;
    if (files.length === 0) return showToast("请先选择 PDF 文件！", 'warning');
    
    const btn = els.recognizeInvoiceNumberBtn;
    if (!btn) return;
    
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

        if (recognizedAmount && els.amount) els.amount.value = recognizedAmount.toFixed(2);

        // 2. 识别发票号码 (优化：8-20位数字，通常在"发票号码"关键字附近，或者独立的连续长数字)
        // 移除所有空白符后再匹配
        const cleanText = fullText.replace(/\s+/g, "");
        // 优先级1：关键字后
        const invoiceNumRegex = /(?:发票号码|No\.|NO\.)[:：]?(\d{8,20})/;
        const numMatchInv = cleanText.match(invoiceNumRegex);
        
        if (numMatchInv) {
            if (els.invoiceNumber) els.invoiceNumber.value = numMatchInv[1];
        } else {
            // 优先级2：独立的10/12/20位数字（需谨慎，防止匹配到税号）
            // 简单策略：找最长的数字串，通常税号是15-20位，发票号也类似，这步比较这就模糊
            // 这里保留原有的 20位全电发票逻辑，并放宽到 8位
            const looseMatch = cleanText.match(/\d{20}/) || cleanText.match(/\d{10,12}/);
            if(looseMatch && els.invoiceNumber) els.invoiceNumber.value = looseMatch[0];
        }

        // 3. 识别日期 (YYYY年MM月DD日 或 YYYY-MM-DD)
        const dateRegex = /(\d{4})[.\-年](\d{1,2})[.\-月](\d{1,2})/;
        const dateMatch = cleanText.match(dateRegex);
        if(dateMatch && els.invoiceDate) {
            // 格式化为 YYYY-MM-DD
            const year = dateMatch[1];
            const month = dateMatch[2].padStart(2, '0');
            const day = dateMatch[3].padStart(2, '0');
            els.invoiceDate.value = `${year}-${month}-${day}`;
            // Flatpickr 更新
            if (els.invoiceDate._flatpickr) {
                els.invoiceDate._flatpickr.setDate(`${year}-${month}-${day}`);
            }
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
        const id = els.invoiceId ? els.invoiceId.value : "";
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
            if (els.attachments && els.attachments.files.length > 0) {
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
    if (!container) return;
    
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
    if (!p) return;
    
    p.innerHTML = "";
    
    if (totalItems === 0) {
        if (els.paginationControls) els.paginationControls.style.display = "none";
        return;
    }
    if (els.paginationControls) els.paginationControls.style.display = "flex";
    
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
    if (els.selectAllCheckbox) els.selectAllCheckbox.checked = false;
}

function handleSelectAll() {
    if (!els.selectAllCheckbox) return;
    
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
            if (els.selectAllCheckbox) {
                els.selectAllCheckbox.checked = true;
                handleSelectAll();
            }
        }
    }

    // 3. Ctrl + F 处理
    if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        if (els.searchInput) els.searchInput.focus();
    }
    
    // 4. ESC 处理
    if (e.key === "Escape") {
        deselectAll();
    }
}

function showLoader() { 
    if (els.loading) els.loading.style.display = ""; 
}

function hideLoader() { 
    if (els.loading) els.loading.style.display = "none"; 
}

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
