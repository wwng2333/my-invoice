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
  } else {
    loginSection.style.display = "";
    mainSection .style.display = "none";
    logoutBtn .style.display   = "none";
  }
}
renderUI();

/* ---------- 加载发票 ---------- */
async function loadInvoices() {
  loading.style.display = "";
  invoiceList.innerHTML = "";
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
      sort: "-created",
      filter: filters.join(" && ")
    });
    records.forEach(r => invoiceList.appendChild(cardEl(r)));
  } catch (e) { alert("加载失败：" + e.message); }
  loading.style.display = "none";
}

/* ---------- 卡片元素 ---------- */
function cardEl(rec) {
  const col = document.createElement("div");
  col.className = "col-md-4";
  col.innerHTML = `
    <div class="card invoice-card ${selected.has(rec.id) ? "selected":""}" data-id="${rec.id}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="card-title">${rec.description}</h5>
          <span class="badge bg-${color(rec.status)}">${rec.status}</span>
        </div>
        <p class="mb-1">发票号：${rec.invoice_number}</p>
        <p class="mb-1">日期：${new Date(rec.invoice_date).toLocaleDateString()}</p>
        <h6 class="text-muted">金额：¥${Number(rec.amount).toFixed(2)}</h6>
        <p class="text-truncate">${rec.vendor||""}</p>
        ${(rec.attachments||[]).map((_,i)=>`<i class="bi bi-file-earmark-pdf-fill text-danger me-1" title="附件${i+1}"></i>`).join("")}
        <div class="mt-2 d-flex justify-content-end">
          <button class="btn btn-sm btn-outline-primary me-2 edit-btn"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-btn"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
  /* 事件 */
  const card = col.querySelector(".invoice-card");
  card.onclick = (e)=>{
    if (e.target.closest(".edit-btn")||e.target.closest(".delete-btn")) return;
    toggleSelect(rec.id,card);
  };
  col.querySelector(".edit-btn").onclick = ()=>openModal(rec);
  col.querySelector(".delete-btn").onclick= ()=>delInvoice(rec.id);
  return col;
}
const color = s=>({approved:"success",rejected:"danger",pending:"warning"}[s]||"secondary");

/* ---------- 选择逻辑 ---------- */
function toggleSelect(id,card){
  const amount = Number(card.querySelector("h6").textContent.replace("金额：¥", ""));
  if (selected.has(id)){
    selected.delete(id);
    card.classList.remove("selected");
    totalAmount -= amount;
  }
  else {
    selected.add(id);
    card.classList.add("selected");
    totalAmount += amount;
  }
  updateTotalAmountDisplay();
  toggleBatchUI();
}
function toggleBatchUI(){
  batchActions.style.display = selected.size?"flex":"none";
  batchTotalAmount.style.display = selected.size?"block":"none";
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
    $("invoiceDate").value  = rec.invoice_date ? rec.invoice_date.slice(0,10) : "";
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
saveInvoiceBtn.onclick = async () => {
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

        invoiceModal.hide();
        currentAttachments = []; // 清空 currentAttachments
        currentRecord = null; // 清空 currentRecord
        loadInvoices();
    } catch (e) {
        alert("保存失败：" + e.message);
    }
};

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
  document.querySelectorAll(".invoice-card.selected").forEach(c=>c.classList.remove("selected"));
  totalAmount = 0;
  updateTotalAmountDisplay();
  toggleBatchUI();
};