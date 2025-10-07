/* PocketBase 实例地址，如改端口请同步修改 */
const pb = new PocketBase(window.location.origin);


/* DOM 引用 */
const $ = (id) => document.getElementById(id);
const loginForm       = $("loginForm");
const loginSection    = $("loginSection");
const mainSection     = $("mainSection");
const logoutBtn       = $("logoutBtn");
const addInvoiceBtn   = $("addInvoiceBtn");
const invoiceModal    = new bootstrap.Modal($("invoiceModal"));
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
let attachments       = $("attachments");

let selected = new Set();
let totalAmount = 0;
// 当前正在编辑的记录已有附件列表，用于更新时保留
let currentAttachments = [];
let currentRecord = null;

/* ---------- 登录 / 退出 ---------- */
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("email").value, pass = $("password").value;
  try {
    await pb.collection("users").authWithPassword(email, pass);
    renderUI();
  } catch (err) { alert("登录失败：" + err.message); }
});
logoutBtn.onclick = () => { pb.authStore.clear(); renderUI(); };

/* ---------- UI 渲染 ---------- */
function renderUI() {
  if (pb.authStore.isValid) {
    loginSection.style.display = "none";
    mainSection .style.display = "";
    logoutBtn.style.display    = "";
    loadInvoices();
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
  } else {
    loginSection.style.display = "";
    mainSection .style.display = "none";
    logoutBtn .style.display   = "none";
  }
}
renderUI();

/* ---------- 加载发票 ---------- */
async function loadInvoices(sortBy = "created", sortOrder = "desc") {
  loading.style.display = "";
  invoiceList.innerHTML = ""; // 清空 tbody
  selected.clear();
  totalAmount = 0;
  updateTotalAmountDisplay();
  toggleBatchUI();

  const filters = [];
  if (searchInput.value.trim()) {
    const term = searchInput.value.trim();
    filters.push(`invoice_number ~ "${term}" || vendor ~ "${term}" || description ~ "${term}"`);
  }
  if (statusFilter.value) filters.push(`status = "${statusFilter.value}"`);

  try {
    const records = await pb.collection("invoices").getFullList({
      sort: `${sortOrder === "desc" ? "-" : ""}${sortBy}`,
      filter: filters.join(" && ")
    });
    records.forEach(r => invoiceList.appendChild(cardEl(r)));
  } catch (e) { alert("加载失败：" + e.message); }
  loading.style.display = "none";
}

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
    <td>${(rec.attachments||[]).map((_,i)=>`<i class="bi bi-file-earmark-pdf-fill text-danger me-1" title="附件${i+1}"></i>`).join("")}</td>
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
}

function toggleBatchUI() {
  batchActions.style.display = selected.size ? "flex" : "none";
  batchTotalAmount.style.display = selected.size ? "block" : "none";
  if (selected.size === 0) {
    totalAmount = 0;
    updateTotalAmountDisplay();
  }
}

function updateTotalAmountDisplay() {
  batchTotalAmount.textContent = `总金额: ¥${totalAmount.toFixed(2)}`;
}

/* ---------- 搜索过滤监听 ---------- */
[searchInput,statusFilter].forEach(el=>el.oninput=debounce(loadInvoices,300));
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

        } else {
            // ----- 新建逻辑 -----
            await pb.collection("invoices").create(fd);
        }

        saveInvoiceBtn.blur(); // 确保在模态框隐藏前移除焦点
        invoiceModal.hide();
        currentAttachments = []; // 清空 currentAttachments
        currentRecord = null; // 清空 currentRecord
        loadInvoices();
        console.log("Invoice saved successfully.");
    } catch (e) {
        console.error("Error saving invoice:", e);
        alert("保存失败：" + e.message);
    }
});

/* ---------- 删除 ---------- */
async function delInvoice(id){
  if(!confirm("确定删除?"))return;
  try{await pb.collection("invoices").delete(id);loadInvoices();}
  catch(e){alert("删除失败："+e.message);}
}

/* ---------- 批量删除 ---------- */
batchDeleteBtn.onclick = async ()=>{
  if(!selected.size||!confirm(`删除选中 ${selected.size} 条?`))return;
  loading.style.display="";
  await Promise.all([...selected].map(id=>pb.collection("invoices").delete(id)));
  selected.clear();toggleBatchUI();loadInvoices();
};

/* ---------- 批量下载附件 ---------- */
batchDownloadBtn.onclick = async ()=>{
  if(!selected.size)return;
  loading.style.display="";
  const zip = new JSZip();
  for(const id of selected){
    const rec = await pb.collection("invoices").getOne(id);
    let fileCounter = 0;
    for(const file of rec.attachments||[]){
      const blob = await fetch(pb.files.getURL(rec,file)).then(r=>r.blob());
      const originalExtension = file.split('.').pop();
      zip.file(`${rec.invoice_number}_${++fileCounter}.${originalExtension}`,blob);
    }
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
};