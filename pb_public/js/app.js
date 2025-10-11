/* PocketBase 实例地址，如改端口请同步修改 */
const pb = new PocketBase(window.location.origin);


/* DOM 引用 */
const $ = (id) => document.getElementById(id);
const loginForm       = $("loginForm");
const loginSection    = $("loginSection");
const mainSection     = $("mainSection");
const logoutBtn       = $("logoutBtn");
const currentUserSpan = $("currentUser");
const currentAvatarImg = $("currentAvatar");
const addInvoiceBtn   = $("addInvoiceBtn");
const modalTitle      = $("modalTitle");
const invoiceForm     = $("invoiceForm");
const saveInvoiceBtn  = $("saveInvoiceBtn");
const invoiceList     = $("invoiceList");
const loading         = $("loading");
const searchInput     = $("searchInput");
const statusFilter    = $("statusFilter");
const batchActions    = $("batchActions");
const batchDeleteBtn  = $("batchDeleteBtn");
const batchDownloadBtn= $("batchDownloadBtn");
const deselectAllBtn  = $("deselectAllBtn");
const batchTotalAmount= $("batchTotalAmount");
const batchCount      = $("batchCount");
const selectAllCheckbox = $("selectAllCheckbox");
const batchStatusSelect = $("batchStatusSelect");
const batchSetStatusBtn = $("batchSetStatusBtn");
let attachments       = $("attachments");
let paginationControls; // 声明为let
const pagination      = $("pagination");
const itemsPerPageSelect = $("itemsPerPageSelect");
const recognizeInvoiceNumberBtn = $("recognizeInvoiceNumberBtn");
const noInvoicesMessage = $("noInvoicesMessage");
// 将模态框的初始化移动到 DOMContentLoaded 事件中
let invoiceModal; // 声明为let
let confirmDeleteModal;
document.addEventListener("DOMContentLoaded", () => {
  invoiceModal = new bootstrap.Modal($("invoiceModal")); // 在DOMContentLoaded中初始化
  confirmDeleteModal = new bootstrap.Modal($("confirmDeleteModal"));
  paginationControls = $("paginationControlsWrapper"); // 在DOMContentLoaded中初始化
});
const confirmDeleteBtn = $("confirmDeleteBtn");

let selected = new Set();
let totalAmount = 0;
// 当前正在编辑的记录已有附件列表，用于更新时保留
let currentAttachments = [];
let currentRecord = null;
let currentPage = 1;
let itemsPerPage; // 默认每页显示10条
let totalPages = 0;

/* ---------- 登录 / 退出 ---------- */
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("email").value, pass = $("password").value;
  try {
    await pb.collection("users").authWithPassword(email, pass);
    renderUI();
  } catch (err) {
    showToast("登录失败：" + err.message, 'danger');
  }
});
logoutBtn.onclick = () => { pb.authStore.clear(); renderUI(); };

/* ---------- UI 渲染 ---------- */
function renderUI() {
  if (pb.authStore.isValid) {
    loginSection.style.display = "none";
    mainSection .style.display = "";
    logoutBtn.style.display    = "";
    currentUserSpan.style.display = "";
    currentUserSpan.textContent = pb.authStore.model ? pb.authStore.model.email : "";
    if(pb.authStore.model){
      currentAvatarImg.style.display="";
      if(pb.authStore.model.avatar){
        currentAvatarImg.src = pb.files.getURL(pb.authStore.model, pb.authStore.model.avatar);
      }else{
        const nameEnc = encodeURIComponent(pb.authStore.model.email);
        currentAvatarImg.src = `https://ui-avatars.com/api/?name=${nameEnc}&background=0D6EFD&color=ffffff&size=64`;
      }
    }
    // 初始化 itemsPerPage
    itemsPerPage = parseInt(itemsPerPageSelect.value) || 10;
    loadInvoices(undefined, undefined, currentPage, itemsPerPage);
    // 为可排序的表头添加事件监听器
    document.querySelectorAll("th[data-sort-by]").forEach(th => {
      th.addEventListener("click", () => {
        console.log("Sort header clicked:", th.dataset.sortBy, th.dataset.sortOrder);
        const sortBy = th.dataset.sortBy;
        let sortOrder = th.dataset.sortOrder;

        // 切换排序顺序
        sortOrder = sortOrder === "asc" ? "desc" : "asc";
        th.dataset.sortOrder = sortOrder;

        // 更新所有排序图标
        document.querySelectorAll("th[data-sort-by] i").forEach(icon => {
          icon.className = "bi bi-sort-alpha-down"; // 重置所有图标
        });
        // 更新当前点击的图标
        const icon = th.querySelector("i");
        if (icon) {
          icon.className = sortOrder === "asc" ? "bi bi-sort-alpha-down" : "bi bi-sort-alpha-up";
        }

        loadInvoices(sortBy, sortOrder);
      });
    });
    // 每页显示数量改变事件
    itemsPerPageSelect.onchange = () => {
      itemsPerPage = parseInt(itemsPerPageSelect.value);
      currentPage = 1; // 改变每页数量时重置到第一页
      const currentSortBy = document.querySelector("th[data-sort-by][data-sort-order]");
      const sortBy = currentSortBy ? currentSortBy.dataset.sortBy : "invoice_date";
      const sortOrder = currentSortBy ? currentSortBy.dataset.sortOrder : "desc";
      loadInvoices(sortBy, sortOrder, currentPage, itemsPerPage);
    };
  } else {
    loginSection.style.display = "";
    mainSection .style.display = "none";
    logoutBtn .style.display   = "none";
    currentUserSpan.style.display = "none";
    currentAvatarImg.style.display = "none";
  }
}
renderUI();
async function loadInvoices(sortBy = "invoice_date", sortOrder = "desc", page = currentPage, perPage = itemsPerPage) {
  loading.style.display = "";
  invoiceList.innerHTML = ""; // 清空 tbody
  selected.clear();
  totalAmount = 0;
  updateTotalAmountDisplay();
  toggleBatchUI();
  selectAllCheckbox.checked = false; // 重置全选框状态
  batchCount.textContent = ""; // 清空已选数量显示

  const filters = [];
  if (searchInput.value.trim()) {
    const term = searchInput.value.trim();
    filters.push(`invoice_number ~ "${term}" || vendor ~ "${term}" || description ~ "${term}"`);
  }
  if (statusFilter.value) filters.push(`status = "${statusFilter.value}"`);

  try {
    const result = await pb.collection("invoices").getList(page, perPage, {
      sort: `${sortOrder === "desc" ? "-" : ""}${sortBy}`,
      filter: filters.join(" && ")
    });
    result.items.forEach(r => invoiceList.appendChild(cardEl(r)));
    if (result.items.length === 0) {
      noInvoicesMessage.style.display = "";
    } else {
      noInvoicesMessage.style.display = "none";
    }
    currentPage = result.page;
    totalPages = result.totalPages;
    renderPagination(result.totalItems);
  } catch (e) {
      showToast("加载失败：" + e.message, 'danger');
    }
  loading.style.display = "none";
}

// 渲染分页控件
function renderPagination(totalItems) {
  // Remove existing total records display
  const existingTotalRecordsSpan = paginationControls.querySelector(".total-records-info");
  if (existingTotalRecordsSpan) {
    existingTotalRecordsSpan.remove();
  }

  pagination.innerHTML = ""; // 清空现有分页

  // Display total record count and items per page in one每页显示 label
  const itemsPerPageLabel = paginationControls.querySelector('label[for="itemsPerPageSelect"]');
  if (itemsPerPageLabel) {
    itemsPerPageLabel.textContent = `共 ${totalItems} 条记录，每页显示：`;
  }

  // Determine overall paginationControls visibility (contains total records and items per page select)
  if (totalItems > 0 || totalPages > 1) {
    paginationControls.style.display = "flex";
  } else {
    paginationControls.style.display = "none";
  }

  // Determine pagination links visibility
  if (totalPages <= 1) {
    pagination.style.display = "none"; // Hide pagination links if only one page
    return; // Exit early as no pagination links are needed
  } else {
    pagination.style.display = "flex"; // Show pagination links if more than one page
  }

  // 上一页按钮
  const prevItem = document.createElement("li");
  prevItem.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  prevItem.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
  prevItem.onclick = (e) => { e.preventDefault(); if (currentPage > 1) { currentPage--; loadInvoices(); } };
  pagination.appendChild(prevItem);

  // 页码
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstPageItem = document.createElement("li");
    firstPageItem.className = `page-item ${1 === currentPage ? "active" : ""}`;
    firstPageItem.innerHTML = `<a class="page-link" href="#">1</a>`;
    firstPageItem.onclick = (e) => { e.preventDefault(); currentPage = 1; loadInvoices(); };
    pagination.appendChild(firstPageItem);
    if (startPage > 2) {
      const ellipsisItem = document.createElement("li");
      ellipsisItem.className = "page-item disabled";
      ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
      pagination.appendChild(ellipsisItem);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageItem = document.createElement("li");
    pageItem.className = `page-item ${i === currentPage ? "active" : ""}`;
    pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    pageItem.onclick = (e) => { e.preventDefault(); currentPage = i; loadInvoices(); };
    pagination.appendChild(pageItem);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsisItem = document.createElement("li");
      ellipsisItem.className = "page-item disabled";
      ellipsisItem.innerHTML = `<span class="page-link">...</span>`;
      pagination.appendChild(ellipsisItem);
    }
    const lastPageItem = document.createElement("li");
    lastPageItem.className = `page-item ${totalPages === currentPage ? "active" : ""}`;
    lastPageItem.innerHTML = `<a class="page-link" href="#">${totalPages}</a>`;
    lastPageItem.onclick = (e) => { e.preventDefault(); currentPage = totalPages; loadInvoices(); };
    pagination.appendChild(lastPageItem);
  }

  // 下一页按钮
  const nextItem = document.createElement("li");
  nextItem.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
  nextItem.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>`;
  nextItem.onclick = (e) => { e.preventDefault(); if (currentPage < totalPages) { currentPage++; loadInvoices(); } };
  pagination.appendChild(nextItem);
}

// 每页显示数量改变事件
itemsPerPageSelect.onchange = () => {
  itemsPerPage = parseInt(itemsPerPageSelect.value);
  currentPage = 1; // 改变每页数量时重置到第一页
  loadInvoices();
};

/* ---------- 卡片元素 ---------- */
function cardEl(rec) {
  const tr = document.createElement("tr");
  tr.className = `invoice-row ${selected.has(rec.id) ? "selected":""}`;
  tr.dataset.id = rec.id;
  tr.innerHTML = `
    <td><input type="checkbox" class="row-select-checkbox" ${selected.has(rec.id) ? "checked":""}></td>
    <td>${rec.invoice_number}</td>
    <td>${new Date(rec.invoice_date).toISOString().slice(0,10)}</td>
    <td>${rec.vendor}</td>
    <td>¥${Number(rec.amount).toFixed(2)}</td>

    <td><span class="badge bg-${color(rec.status)}">${rec.status}</span></td>
    <td class="text-truncate" style="max-width: 150px;">${rec.description || "-"}</td>
    <td>${(rec.attachments||[]).length === 0 ? "无" : (rec.attachments||[]).map((_,i)=>`<i class="bi bi-file-earmark-pdf-fill text-danger me-1" title="附件${i+1}"></i>`).join("")}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary me-2 edit-btn"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-outline-danger delete-btn"><i class="bi bi-trash"></i></button>
    </td>`;

  /* 事件 */
  tr.querySelector(".row-select-checkbox").onclick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡到行点击事件
    toggleSelect(rec.id, tr);
  };
  tr.querySelector(".edit-btn").onclick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡到行点击事件
    openModal(rec);
  };
  tr.querySelector(".delete-btn").onclick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡到行点击事件
    delInvoice(rec.id);
  };
  tr.onclick = () => {
    toggleSelect(rec.id, tr);
  };
  return tr;
}
const color = s=>({approved:"success",rejected:"danger",pending:"warning"}[s]||"secondary");

/* ---------- 选择逻辑 ---------- */
function toggleSelect(id, row) {
  const amountText = row.querySelector("td:nth-child(5)").textContent; // 获取金额列的文本
  const amount = Number(amountText.replace("¥", ""));

  const checkbox = row.querySelector(".row-select-checkbox");

  if (selected.has(id)) {
    selected.delete(id);
    row.classList.remove("selected");
    checkbox.checked = false;
    totalAmount -= amount;
  } else {
    selected.add(id);
    row.classList.add("selected");
    checkbox.checked = true;
    totalAmount += amount;
  }
  updateTotalAmountDisplay();
  toggleBatchUI();
  // 更新全选框的状态
  const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
  const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
  selectAllCheckbox.checked = allChecked;
}

function toggleBatchUI() {
  batchActions.style.display = selected.size ? "flex" : "none";
  batchTotalAmount.style.display = selected.size ? "block" : "none";
  batchCount.style.display = selected.size ? "block" : "none";
  if (selected.size === 0) {
    totalAmount = 0;
    updateTotalAmountDisplay();
  }
}

function updateTotalAmountDisplay() {
  batchTotalAmount.textContent = `总金额: ¥${totalAmount.toFixed(2)}`;
  batchCount.textContent = `已选: ${selected.size} 条`;
}

/* ---------- 搜索过滤监听 ---------- */
searchInput.oninput = debounce(() => { currentPage = 1; loadInvoices(); }, 300);
statusFilter.onchange = debounce(() => { currentPage = 1; loadInvoices(); }, 300);
function debounce(fn,ms){let t;return ()=>{clearTimeout(t);t=setTimeout(fn,ms);}}

/* ---------- 新增 / 编辑 ---------- */
addInvoiceBtn.onclick = ()=>openModal();
function openModal(rec){
  invoiceForm.reset();
  // 克隆并替换文件输入框，以确保其完全重置
    const oldAttachments = attachments;
    attachments = oldAttachments.cloneNode(true);
    oldAttachments.parentNode.replaceChild(attachments, oldAttachments);

    // 清空文件输入框的值
    attachments.value = ''; // 显式清空文件输入框
  $("invoiceId").value = rec?rec.id:"";
  currentAttachments = rec && rec.attachments ? [...rec.attachments] : [];
  currentRecord = rec; // 保存当前记录
  $("attachmentPreview").innerHTML=""; // 确保在处理 currentAttachments 之前清空
  modalTitle.textContent = rec?"编辑发票":"添加发票";

  if(rec){
    $("invoiceNumber").value = rec.invoice_number;
    // 日期字段需截取 YYYY-MM-DD 才能填充到 date 输入框
    $("invoiceDate").value  = rec.invoice_date ? new Date(rec.invoice_date).toISOString().slice(0,10) : "";
    $("vendor").value    = rec.vendor;
    $("amount").value    =rec.amount;
    $("taxAmount").value =rec.tax_amount||"";
    $("status").value    =rec.status;
    $("description").value=rec.description||"";
    renderAttachmentPreview(); // 调用新的渲染函数
  }
  invoiceModal.show();

  // 识别发票号码按钮点击事件
  recognizeInvoiceNumberBtn.onclick = async () => {
    const files = attachments.files;
    if (files.length === 0) {
      showToast("请选择 PDF 文件！", 'warning');
      return;
    }
    if (files.length > 1) {
      showToast("目前只支持识别单个 PDF 文件的发票号码。", 'warning');
      return;
    }

    const file = files[0];
    if (file.type !== "application/pdf") {
      alert("请选择 PDF 文件！");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: './cmaps/',
        cMapPacked: true,
      }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(" ");
      }

      console.log("提取到的 PDF 文本:", fullText); // 打印全部文本到控制台

      // 尝试识别金额
      // 优化金额识别逻辑：直接识别大写金额字符串，并取最后一个匹配项
      const chineseAmountRegex = /([零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元角分整]+)/g;
      const allChineseAmountMatches = [...fullText.matchAll(chineseAmountRegex)];
      let amount = null;

      if (allChineseAmountMatches.length > 0) {
        const lastChineseAmountMatch = allChineseAmountMatches[allChineseAmountMatches.length - 1];
        const chineseAmountStr = lastChineseAmountMatch[1];
        console.log("识别到大写金额:", chineseAmountStr);
        amount = convertChineseToNumber(chineseAmountStr);
        console.log("转换后金额:", amount);
        if (amount !== null) {
          document.getElementById('amount').value = amount.toFixed(2);
        }
      } else {
        console.log("未识别到大写金额。");
        // Fallback to previous numerical amount recognition if Chinese amount not found
        const amountRegex = /(?:小写|价税合计(?:（大写）)?)\s*[:：]?\s*.*?([¥$]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/;
        const amountMatch = fullText.match(amountRegex);
        if (amountMatch && amountMatch[1]) {
          amount = parseFloat(amountMatch[1].replace(/,/g, ''));
          console.log("识别到的金额 (fallback):", amount);
        } else {
          console.log("未识别到金额 (fallback)。");
        }
      }

      // 尝试识别发票号码，这里使用一个简单的正则表达式作为示例
      // 实际应用中可能需要更复杂的正则表达式或模式匹配
      // 优化发票号码识别逻辑：发票号码为20位纯数字
      const invoiceNumberMatch = fullText.match(/\b\d{20}\b/);
      if (invoiceNumberMatch) {
        $("invoiceNumber").value = invoiceNumberMatch[0];
        showToast("发票号码识别成功！", 'success');
      } else {
        showToast("未能识别到发票号码，请手动输入。", 'warning');
      }

    } catch (error) {
      console.error("识别发票号码时出错:", error);
      showToast("识别发票号码时出错: " + error.message, 'danger');
    }
  };
}

// 渲染附件预览
function renderAttachmentPreview() {
  const previewEl = $("attachmentPreview");
  previewEl.innerHTML = ""; // 清空现有预览

  if (currentAttachments.length > 0) {
    currentAttachments.forEach(f => {
      const attachmentDiv = document.createElement("div");
      attachmentDiv.className = "d-flex align-items-center mb-1";
      attachmentDiv.innerHTML = `
        <a href="${pb.files.getURL(currentRecord, f)}" target="_blank" class="me-2">${f}</a>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" data-filename="${f}">
          <i class="bi bi-x"></i>
        </button>
      `;
      previewEl.appendChild(attachmentDiv);
    });

    // 为删除按钮添加事件监听器
    previewEl.querySelectorAll("button[data-filename]").forEach(button => {
      button.onclick = (e) => {
        const filename = e.currentTarget.dataset.filename;
        removeAttachmentFromPreview(filename);
      };
    });
  } else {
    previewEl.innerHTML = "<small>无附件</small>";
  }
}

// 从预览中移除附件
function removeAttachmentFromPreview(filename) {
  currentAttachments = currentAttachments.filter(f => f !== filename);
  renderAttachmentPreview(); // 重新渲染预览
}

/* ---------- 保存 ---------- */

invoiceForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // 阻止表单默认提交，以便进行异步保存
    console.log("Attempting to save invoice...");
    try {
        const id = $("invoiceId").value;
        const fd = new FormData(invoiceForm);
        fd.append("user", pb.authStore.model.id); // 归属用户

        if (id) {
            // ----- 更新逻辑 -----
            // 处理附件删除
            const originalAttachments = currentRecord ? currentRecord.attachments || [] : [];
            const attachmentsToDelete = originalAttachments.filter(f => !currentAttachments.includes(f));
            attachmentsToDelete.forEach(f => fd.append("attachments-", f));

            // 检查用户是否在文件输入框中选择了新文件
            if (attachments.files.length > 0) {
                fd.delete("attachments"); // 确保没有旧的 'attachments' 字段
                for (const file of attachments.files) {
                    fd.append("attachments+", file);
                }
            } else {
                // 如果没有新文件上传，则明确告诉 PocketBase 哪些文件应该被保留
                fd.delete("attachments"); // 移除任何现有的 'attachments' 字段
                currentAttachments.forEach(f => fd.append("attachments", f));
            }

            await pb.collection("invoices").update(id, fd);
            showToast("发票更新成功！", 'success');

        } else {
            // ----- 新建逻辑 -----
            await pb.collection("invoices").create(fd);
            showToast("发票添加成功！", 'success');
        }

        saveInvoiceBtn.blur(); // 确保在模态框隐藏前移除焦点
        invoiceModal.hide();
        currentAttachments = []; // 清空 currentAttachments
        currentRecord = null; // 清空 currentRecord
        loadInvoices();
        console.log("Invoice saved successfully.");
    } catch (e) {
        console.error("Error saving invoice:", e);
        showToast("保存失败：" + e.message, 'danger');
    }
});

/* ---------- 删除 ---------- */
async function delInvoice(id){
  confirmDeleteBtn.dataset.deleteId = id; // 存储要删除的 ID
  confirmDeleteBtn.dataset.deleteType = 'single'; // 标记为单个删除
  confirmDeleteModal.show();
}

/* ---------- 批量删除 ---------- */
batchDeleteBtn.onclick = async ()=>{
  if(!selected.size){
    showToast("请选择要删除的发票！", 'warning');
    return;
  }
  confirmDeleteBtn.dataset.deleteType = 'batch'; // 标记为批量删除
  confirmDeleteModal.show();
};

/* ---------- 批量设置状态 ---------- */
batchSetStatusBtn.onclick = async () => {
  const newStatus = batchStatusSelect.value;
  if (!newStatus) {
    showToast("请选择一个状态！", 'warning');
    return;
  }
  if (!selected.size || !confirm(`确定将选中 ${selected.size} 条发票状态设置为 "${newStatus}"?`)) return;

  loading.style.display = "";
  try {
    await Promise.all([...selected].map(id =>
      pb.collection("invoices").update(id, { status: newStatus })
    ));
    selected.clear();
    toggleBatchUI();
    loadInvoices();
    batchStatusSelect.value = ""; // 重置选择框
  } catch (e) {
    showToast("批量设置状态失败：" + e.message, 'danger');
  }
  loading.style.display = "none";
};

/* ---------- 批量下载附件 ---------- */
batchDownloadBtn.onclick = async ()=>{
  if(!selected.size)return;
  loading.style.display="";
  const zip = new JSZip();
  const invoicesData = []; // 用于存储发票数据以生成 CSV

  for(const id of selected){
    const rec = await pb.collection("invoices").getOne(id);
    invoicesData.push({
      invoice_number: rec.invoice_number,
      invoice_date: new Date(rec.invoice_date).toISOString().slice(0,10),
      vendor: rec.vendor,
      amount: Number(rec.amount).toFixed(2),
      tax_amount: Number(rec.tax_amount).toFixed(2),
      status: rec.status,
      description: rec.description || "",
      attachments: (rec.attachments || []).join("; ")
    });

    let fileCounter = 0;
    for(const file of rec.attachments||[]){
      const blob = await fetch(pb.files.getURL(rec,file)).then(r=>r.blob());
      const originalExtension = file.split('.').pop();
      zip.file(`${rec.invoice_number}_${++fileCounter}.${originalExtension}`,blob);
    }
  }

  // 生成 CSV 文件


// 确认删除模态框的事件监听器
confirmDeleteBtn.addEventListener('click', async () => {
  const deleteType = confirmDeleteBtn.dataset.deleteType;
  loading.style.display = "";
  try {
    if (deleteType === 'single') {
      const id = confirmDeleteBtn.dataset.deleteId;
      await pb.collection("invoices").delete(id);
      showToast("发票删除成功！", 'success');
    } else if (deleteType === 'batch') {
      await Promise.all([...selected].map(id => pb.collection("invoices").delete(id)));
      selected.clear();
      toggleBatchUI();
      showToast("批量删除成功！", 'success');
    }
    loadInvoices();
  } catch (e) {
    showToast("删除失败：" + e.message, 'danger');
  }
  loading.style.display = "none";
  confirmDeleteModal.hide();
});  if (invoicesData.length > 0) {
    const headers = Object.keys(invoicesData[0]);
    const csvContent = [headers.join(","), ...invoicesData.map(row => headers.map(fieldName => JSON.stringify(row[fieldName])).join(","))].join("\n");
    // 添加 UTF-8 BOM，确保 Excel 等软件正确识别中文编码
    const csvWithBOM = "\ufeff" + csvContent;
    zip.file("invoices.csv", csvWithBOM);
  }

  zip.generateAsync({type:"blob"}).then(b=>saveAs(b,"invoices.zip"));
  loading.style.display="none";
};

/* ---------- 取消选择 ---------- */
deselectAllBtn.onclick = ()=>{
  selected.clear();
  document.querySelectorAll(".invoice-row.selected").forEach(c=>c.classList.remove("selected"));
  document.querySelectorAll(".row-select-checkbox").forEach(c=>c.checked = false);
  totalAmount = 0;
  updateTotalAmountDisplay();
  toggleBatchUI();
  selectAllCheckbox.checked = false; // 取消全选框的选中状态
};

/* ---------- 全选 ---------- */
// 监听 Ctrl+A 快捷键
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "a") {
    e.preventDefault(); // 阻止浏览器默认的 Ctrl+A 行为
    const allCheckboxes = document.querySelectorAll(".row-select-checkbox");
    const allInvoicesSelected = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);

    if (allInvoicesSelected) {
      // 如果所有发票都已选中，则取消全选
      deselectAllBtn.click();
    } else {
      // 否则，选中所有发票
      selectAllCheckbox.checked = true;
      selectAllCheckbox.onchange(); // 手动触发 change 事件
    }
  }
});

// 监听 ESC 键取消选中
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    deselectAllBtn.click();
  }
});

// 监听 Ctrl+F 快捷键，聚焦到搜索框
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "f") {
    e.preventDefault(); // 阻止浏览器默认的 Ctrl+F 行为
    searchInput.focus();
  }
});
selectAllCheckbox.onchange = () => {
  const isChecked = selectAllCheckbox.checked;
  document.querySelectorAll(".invoice-row").forEach(row => {
    const id = row.dataset.id;
    const checkbox = row.querySelector(".row-select-checkbox");
    const amountText = row.querySelector("td:nth-child(5)").textContent;
    const amount = Number(amountText.replace("¥", ""));

    if (isChecked) {
      if (!selected.has(id)) {
        selected.add(id);
        row.classList.add("selected");
        checkbox.checked = true;
        totalAmount += amount;
      }
    } else {
      if (selected.has(id)) {
        selected.delete(id);
        row.classList.remove("selected");
        checkbox.checked = false;
        totalAmount -= amount;
      }
    }
  });
  updateTotalAmountDisplay();
  toggleBatchUI();
};

// 初始化 flatpickr 日期选择
flatpickr("#invoiceDate", {
  dateFormat: "Y-m-d",
  locale: flatpickr.l10ns.zh,
});

// Helper function to convert Chinese capitalized numbers to numerical values
function convertChineseToNumber(chineseStr) {
  const chineseNumMap = {
    '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9
  };
  const chineseUnitMap = {
    '拾': 10, '佰': 100, '仟': 1000, '万': 10000, '亿': 100000000
  };

  let result = 0;
  let tempNum = 0;
  let section = 0;
  let hasDecimal = false;
  let decimalPart = 0;
  let decimalPlace = 0.1;

  // Handle decimal part first if '角' or '分' exists
  const decimalMatch = chineseStr.match(/(?:圆|元)(.*)/);
  if (decimalMatch && decimalMatch[1]) {
    const decimalStr = decimalMatch[1];
    for (let i = 0; i < decimalStr.length; i++) {
      const char = decimalStr[i];
      if (char === '角') {
        decimalPart += tempNum * 0.1;
        tempNum = 0;
      } else if (char === '分') {
        decimalPart += tempNum * 0.01;
        tempNum = 0;
      } else if (chineseNumMap[char] !== undefined) {
        tempNum = chineseNumMap[char];
      }
    }
    chineseStr = chineseStr.substring(0, chineseStr.indexOf(decimalMatch[0]));
    hasDecimal = true;
  }

  for (let i = 0; i < chineseStr.length; i++) {
    const char = chineseStr[i];
    if (chineseNumMap[char] !== undefined) {
      tempNum = chineseNumMap[char];
    } else if (chineseUnitMap[char] !== undefined) {
      if (char === '万' || char === '亿') {
        section = (section + tempNum) * chineseUnitMap[char];
        result += section;
        section = 0;
        tempNum = 0;
      } else {
        section += tempNum * chineseUnitMap[char];
        tempNum = 0;
      }
    } else if (char === '圆' || char === '元') {
      result += section + tempNum;
      section = 0;
      tempNum = 0;
    }
  }
  result += section + tempNum;

  return result + decimalPart;
}

  // Helper function to show Bootstrap Toasts
  function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      console.error('Toast container not found!');
      // Fallback to a simple console log or no action if toast container is missing
      // alert(message); // Removed fallback alert
      return;
    }

    const toastId = `toast-${Date.now()}`;
    const toastHtml = `
      <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            ${message}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  }
