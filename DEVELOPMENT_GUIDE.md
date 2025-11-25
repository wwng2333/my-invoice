# 开发指南 - MyInvoice v1.0.1

**版本**: v1.0.1  
**最后更新**: 2025年11月25日  
**维护者**: MyInvoice Team

---

## 📚 目录

1. [快速开始](#快速开始)
2. [项目结构](#项目结构)
3. [核心配置](#核心配置)
4. [函数参考](#函数参考)
5. [添加新功能](#添加新功能)
6. [调试技巧](#调试技巧)
7. [常见问题](#常见问题)
8. [版本发布](#版本发布)

---

## 快速开始

### 开发环境设置

#### 1. 安装 PocketBase

```bash
# 从官网下载
https://github.com/pocketbase/pocketbase/releases/

# 解压到项目目录
unzip pocketbase_*.zip

# 启动服务
./pocketbase serve
```

#### 2. 修改配置

编辑 `pb_public/js/app.js`：

```javascript
const CONFIG = {
    // 改为本地开发地址
    PB_URL: "http://127.0.0.1:8090",
    // ... 其他配置保持不变
};
```

#### 3. 访问应用

- 数据管理后台: http://127.0.0.1:8090/_/
- 应用前端: http://127.0.0.1:8090/
- 使用创建的用户账户登录

#### 4. 调试

打开浏览器开发者工具 (F12)：
- 查看 Console 获取日志信息
- 查看 Network 查看 API 调用
- 查看 Application 检查存储

---

## 项目结构

```
my-invoice/
├── pb_public/                    # 前端文件（由 PocketBase 提供）
│   ├── index.html               # 主页面
│   │   ├── HTML 结构            # Bootstrap 布局
│   │   ├── 模态框声明            # Invoice Modal, Delete Modal
│   │   └── 脚本引入              # app.js, 外部库等
│   ├── js/
│   │   └── app.js               # 主应用程序（1115 行）
│   │       ├── CONFIG           # 全局配置
│   │       ├── 状态映射           # STATUS_MAP, STATUS_COLORS
│   │       ├── PB 初始化         # PocketBase 实例
│   │       ├── DOM 缓存          # els 对象
│   │       ├── 事件监听           # setupEventListeners()
│   │       ├── UI 渲染            # renderUI(), loadInvoices()
│   │       ├── 表格行            # createInvoiceRow()
│   │       ├── 选择逻辑           # toggleSelect(), updateBatchUI()
│   │       ├── CRUD 操作         # openModal(), handleSaveInvoice()
│   │       ├── 批量操作           # handleBatchDelete(), handleBatchSetStatus()
│   │       ├── 工具函数           # escapeHtml(), debounce(), showToast()
│   │       └── PDF 识别           # handleRecognizePDF()
│   ├── cmaps/                   # PDF 字体映射（PDF.js 需要）
│   └── lib/                     # 第三方库（bootstrap, pdf.js 等）
├── pb_migrations/
│   └── create_invoices_collection.js  # 数据库迁移脚本
├── pb_data/                     # PocketBase 数据存储（本地开发）
├── README.md                    # 项目说明
├── OPTIMIZATION_REPORT.md       # 优化详情（本文件）
├── DEVELOPMENT_GUIDE.md         # 开发指南（本文件）
└── LICENSE                      # MIT 许可

```

---

## 核心配置

### CONFIG 对象

所有全局配置集中在文件顶部：

```javascript
const CONFIG = {
    PB_URL: "https://invoice.csgo.ovh/",      // PocketBase 服务地址
    TIMEOUT: {
        INIT_RETRY: 500,      // DOM 初始化重试间隔（毫秒）
        INIT_DELAY: 100,      // 初始化延迟（毫秒）
        SEARCH_DEBOUNCE: 300  // 搜索防抖延迟（毫秒）
    },
    PAGE_SIZES: [10, 25, 50, 9999],  // 分页选项
    RETRY_MAX: 3                      // 最大重试次数
};
```

### 状态映射

```javascript
// 发票状态翻译
const STATUS_MAP = {
    pending_application: "待申请",      // 待审批
    in_invoicing: "开票中",             // 正在开票
    in_reimbursement: "报销中",         // 正在报销
    reimbursed: "已报销"               // 已完成
};

// 状态对应的 Bootstrap 颜色
const STATUS_COLORS = {
    pending_application: "secondary",   // 灰色
    in_invoicing: "warning",            // 黄色
    in_reimbursement: "primary",        // 蓝色
    reimbursed: "success"               // 绿色
};
```

### 中文数字转换

```javascript
// 用于将大写中文数字转换为阿拉伯数字
const CHINESE_NUM_MAP = {
    '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4,
    '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9
};

const CHINESE_UNIT_MAP = {
    '拾': 10,         // 十
    '佰': 100,        // 百
    '仟': 1000,       // 千
    '万': 10000,      // 万
    '亿': 100000000   // 亿
};

// 使用示例
const amount = convertChineseToNumber("壹仟贰佰叁拾肆圆");  // 1234.00
```

---

## 函数参考

### 初始化函数

#### `safeInitialize()`

初始化应用，检查 DOM 元素加载状态。

```javascript
/**
 * 安全初始化应用
 * - 检查DOM元素是否加载
 * - 初始化Bootstrap模态框
 * - 设置事件监听器
 * - 执行初始渲染
 */
function safeInitialize() { ... }
```

**调用方式**: 自动在 `DOMContentLoaded` 事件时调用

**重试机制**:
- 初始延迟: 100ms
- 每次重试间隔: 500ms
- 最大重试次数: 3 次

#### `initializeElements()`

初始化所有 DOM 元素引用到 `els` 对象。

```javascript
els = {
    loginForm: document.getElementById("loginForm"),
    mainSection: document.getElementById("mainSection"),
    invoiceList: document.getElementById("invoiceList"),
    // ... 共 30+ 个元素
};
```

### 认证函数

#### `handleLogin(e)`

处理用户登录。

```javascript
async function handleLogin(e) {
    e.preventDefault();
    const email = getEl("email").value;
    const password = getEl("password").value;
    
    if (!email || !password) {
        showToast("请输入邮箱和密码", 'warning');
        return;
    }
    
    await pb.collection("users").authWithPassword(email, password);
    renderUI();
}
```

**参数**:
- `e`: 表单提交事件

**错误处理**: 捕获登录错误，显示提示信息

#### `handleLogout()`

处理用户登出。

```javascript
function handleLogout() {
    pb.authStore.clear();
    state.selected.clear();
    state.totalAmount = 0;
    renderUI();
}
```

**效果**:
- 清除认证信息
- 重置应用状态
- 隐藏主界面，显示登录界面

### UI 渲染函数

#### `renderUI()`

渲染主界面，根据登录状态显示/隐藏界面。

```javascript
function renderUI() {
    if (pb.authStore.isValid) {
        // 显示主界面
        // 设置用户信息
        // 加载发票列表
    } else {
        // 显示登录界面
    }
}
```

#### `loadInvoices()`

加载并显示发票列表。

```javascript
async function loadInvoices() {
    try {
        showLoader();
        
        // 重置选择状态
        state.selected.clear();
        state.totalAmount = 0;
        updateBatchUI();

        // 构建过滤条件
        const filters = [];
        if (els.searchInput?.value) {
            filters.push(`invoice_number ~ "${searchTerm}"`);
        }
        if (els.statusFilter?.value) {
            filters.push(`status = "${statusValue}"`);
        }

        // 请求数据
        const result = await pb.collection("invoices").getList(
            state.currentPage,
            state.itemsPerPage,
            { sort: "...", filter: filters.join(" && ") }
        );

        // 渲染列表
        result.items.forEach(r => {
            els.invoiceList.appendChild(createInvoiceRow(r));
        });

        // 更新分页
        renderPagination(result.totalItems);
        
    } catch (e) {
        showToast("加载失败：" + e.message, 'danger');
    } finally {
        hideLoader();
    }
}
```

**过滤条件**:
- 搜索词: 发票号码、供应商、描述
- 状态: pending_application, in_invoicing 等

### 表格行函数

#### `createInvoiceRow(rec)`

创建单条发票表格行。

```javascript
function createInvoiceRow(rec) {
    const tr = document.createElement("tr");
    tr.className = `invoice-row ${state.selected.has(rec.id) ? "selected" : ""}`;
    tr.dataset.id = rec.id;
    tr.dataset.amount = rec.amount;

    tr.innerHTML = `
        <td><input type="checkbox" class="row-select-checkbox"></td>
        <td>${escapeHtml(rec.invoice_number)}</td>
        <td>${rec.invoice_date.slice(0, 10)}</td>
        <td>${escapeHtml(rec.vendor)}</td>
        <td>¥${Number(rec.amount).toFixed(2)}</td>
        <td><span class="badge bg-${getStatusColor(rec.status)}">${STATUS_MAP[rec.status]}</span></td>
        <td class="text-truncate" style="max-width: 150px;">${escapeHtml(rec.description)}</td>
        <td><!-- 附件显示 --></td>
        <td><!-- 编辑/删除按钮 --></td>
    `;

    // 绑定事件...
    return tr;
}
```

**注意**:
- 使用 `escapeHtml()` 防止 XSS
- 保存 id 和 amount 到 dataset
- 绑定编辑、删除按钮事件

### 选择和批量操作

#### `toggleSelect(id, row, checkbox)`

切换单条发票的选中状态。

```javascript
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
```

#### `updateBatchUI()`

更新批量操作界面（显示选中数、总金额等）。

```javascript
function updateBatchUI() {
    const count = state.selected.size;
    
    if (!els.batchActions) return;
    
    if (count > 0) {
        els.batchActions.style.display = "flex";
        els.batchActions.classList.add("show");
    } else {
        els.batchActions.classList.remove("show");
        setTimeout(() => {
            els.batchActions.style.display = "none";
        }, 300);
    }
    
    if (els.selectedCount) els.selectedCount.textContent = count;
    if (els.totalAmountValue) els.totalAmountValue.textContent = state.totalAmount.toFixed(2);
}
```

#### `handleBatchSetStatus()`

批量修改发票状态。

```javascript
async function handleBatchSetStatus() {
    const newStatus = els.batchStatusSelect.value;
    if (!newStatus) {
        showToast("请选择状态", 'warning');
        return;
    }

    showLoader();
    try {
        await Promise.all([...state.selected].map(id =>
            pb.collection("invoices").update(id, { status: newStatus })
        ));
        deselectAll();
        loadInvoices();
        showToast("批量更新成功", 'success');
    } catch (e) {
        showToast("操作失败：" + e.message, 'danger');
    }
    hideLoader();
}
```

#### `handleBatchDownload()`

批量下载发票为 ZIP 文件。

```javascript
async function handleBatchDownload() {
    if (!state.selected.size) return;
    
    showLoader();
    try {
        const zip = new JSZip();
        
        // 并发获取所有发票信息
        const promises = [...state.selected].map(async id => {
            const rec = await pb.collection("invoices").getOne(id);
            
            // 下载附件
            if (rec.attachments) {
                for (let i = 0; i < rec.attachments.length; i++) {
                    const filename = rec.attachments[i];
                    const fileUrl = pb.files.getURL(rec, filename);
                    const blob = await fetch(fileUrl).then(r => r.blob());
                    zip.file(`${rec.invoice_number}_${i+1}.pdf`, blob);
                }
            }
        });

        await Promise.all(promises);
        
        // 生成 ZIP
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Invoices_${new Date().toISOString().slice(0, 10)}.zip`);
        
    } catch (e) {
        showToast("下载失败：" + e.message, 'danger');
    }
    hideLoader();
}
```

### CRUD 操作

#### `openModal(rec)`

打开编辑/新增发票模态框。

```javascript
async function openModal(rec) {
    els.invoiceForm.reset();
    
    if (rec) {
        // 编辑模式：获取完整记录
        state.currentRecord = await pb.collection("invoices").getOne(rec.id);
        
        els.invoiceId.value = rec.id;
        els.invoiceNumber.value = rec.invoice_number;
        els.invoiceDate.value = rec.invoice_date.slice(0, 10);
        els.vendor.value = rec.vendor;
        els.amount.value = rec.amount;
        els.status.value = rec.status;
        els.description.value = rec.description || "";
        
        state.currentAttachments = [...(rec.attachments || [])];
        renderAttachmentPreview();
        
        els.modalTitle.textContent = "编辑发票";
    } else {
        // 新增模式
        els.modalTitle.textContent = "添加发票";
        state.currentRecord = null;
        state.currentAttachments = [];
    }
    
    bsInvoiceModal.show();
}
```

**参数**:
- `rec`: 发票记录对象，undefined 则为新增

#### `handleSaveInvoice(e)`

保存发票（新增或编辑）。

```javascript
async function handleSaveInvoice(e) {
    e.preventDefault();
    try {
        const id = els.invoiceId.value;
        const fd = new FormData(els.invoiceForm);
        fd.append("user", pb.authStore.model.id);

        if (id) {
            // 编辑模式
            // 1. 删除移除的附件
            const toRemove = state.currentRecord.attachments.filter(
                f => !state.currentAttachments.includes(f)
            );
            toRemove.forEach(f => fd.append("attachments-", f));
            
            // 2. 清理旧附件数据
            fd.delete("attachments");
            
            // 3. 添加新附件
            for (const file of els.attachments.files) {
                fd.append("attachments", file);
            }

            await pb.collection("invoices").update(id, fd);
        } else {
            // 新增模式
            await pb.collection("invoices").create(fd);
        }

        showToast(id ? "更新成功" : "创建成功", 'success');
        bsInvoiceModal.hide();
        loadInvoices();
        
    } catch (e) {
        showToast("保存失败：" + e.message, 'danger');
    }
}
```

### 工具函数

#### `escapeHtml(text)`

HTML 转义防止 XSS。

```javascript
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
```

**使用场景**:
- 显示用户输入的文本内容
- 防止恶意脚本注入

#### `debounce(fn, ms)`

防抖函数，延迟执行。

```javascript
function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// 使用示例：搜索防抖
els.searchInput.oninput = debounce(() => {
    state.currentPage = 1;
    loadInvoices();
}, CONFIG.TIMEOUT.SEARCH_DEBOUNCE);
```

**作用**: 防止频繁触发（如每次按键都搜索）

#### `showToast(message, type)`

显示提示信息。

```javascript
function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white"></button>
        </div>
    `;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
}
```

**参数**:
- `message`: 显示的文本信息
- `type`: 'info', 'success', 'warning', 'danger'

#### `convertChineseToNumber(chineseStr)`

中文大写数字转阿拉伯数字。

```javascript
function convertChineseToNumber(chineseStr) {
    // 示例：'壹仟贰佰叁拾肆圆' → 1234
    // 支持 元、角、分
}
```

### PDF 识别函数

#### `handleRecognizePDF()`

从上传的 PDF 自动识别发票信息。

```javascript
async function handleRecognizePDF() {
    const files = els.attachments.files;
    if (files.length === 0) {
        showToast("请先选择 PDF 文件", 'warning');
        return;
    }

    try {
        const file = files[0];
        if (file.type !== "application/pdf") {
            throw new Error("必须是 PDF 文件");
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: './cmaps/',
            cMapPacked: true,
        }).promise;

        let fullText = "";
        // 只读取前 3 页
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join("");
        }

        // 识别金额
        const amountMatch = fullText.match(/(?:小写|金额).*?([¥￥]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
        if (amountMatch) {
            els.amount.value = parseFloat(amountMatch[1].replace(/[¥￥,\s]/g, ''));
        }

        // 识别发票号
        const invoiceMatch = fullText.match(/(?:发票号码|No\.)[:：]?(\d{8,20})/);
        if (invoiceMatch) {
            els.invoiceNumber.value = invoiceMatch[1];
        }

        // 识别日期
        const dateMatch = fullText.match(/(\d{4})[.\-年](\d{1,2})[.\-月](\d{1,2})/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch;
            els.invoiceDate.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        showToast("识别完成，请核对信息", 'success');
        
    } catch (error) {
        showToast("识别失败：" + error.message, 'warning');
    }
}
```

---

## 添加新功能

### 场景 1：添加新的发票字段

**步骤**:

1. **在 PocketBase 中添加字段**
   - 访问 http://127.0.0.1:8090/_/
   - 编辑 invoices 集合
   - 添加新字段（如 `tax_number`）

2. **更新 HTML 表单**
   ```html
   <!-- 在 index.html 的表单中添加 -->
   <input type="text" id="taxNumber" name="tax_number" placeholder="税号">
   ```

3. **在 app.js 中添加 DOM 引用**
   ```javascript
   els = {
       // ...
       taxNumber: getEl("taxNumber"),  // 新增
   };
   ```

4. **在创建/编辑时处理该字段**
   ```javascript
   async function openModal(rec) {
       // ...
       if (rec && els.taxNumber) {
           els.taxNumber.value = rec.tax_number || "";
       }
   }
   ```

5. **在表格显示该字段**
   ```javascript
   function createInvoiceRow(rec) {
       tr.innerHTML = `
           <td>${escapeHtml(rec.tax_number)}</td>
           <!-- 其他列 -->
       `;
   }
   ```

### 场景 2：添加新的批量操作

**步骤**:

1. **在 HTML 中添加按钮**
   ```html
   <button id="batchExportBtn" class="btn btn-sm btn-info">
       <i class="bi bi-download"></i> 导出
   </button>
   ```

2. **在 app.js 中添加 DOM 引用和事件**
   ```javascript
   els.batchExportBtn = getEl("batchExportBtn");

   function setupEventListeners() {
       if (els.batchExportBtn) {
           els.batchExportBtn.onclick = handleBatchExport;
       }
   }
   ```

3. **实现功能**
   ```javascript
   async function handleBatchExport() {
       if (!state.selected.size) {
           showToast("请选择发票", 'warning');
           return;
       }

       showLoader();
       try {
           const records = await Promise.all(
               [...state.selected].map(id => 
                   pb.collection("invoices").getOne(id)
               )
           );
           
           // 导出逻辑
           const csvContent = convertToCSV(records);
           downloadCSV(csvContent);
           
           showToast("导出成功", 'success');
       } catch (e) {
           showToast("导出失败：" + e.message, 'danger');
       }
       hideLoader();
   }
   ```

### 场景 3：添加新的状态

**步骤**:

1. **在 STATUS_MAP 中添加**
   ```javascript
   const STATUS_MAP = {
       // ...
       archived: "已归档"  // 新增
   };
   ```

2. **在 STATUS_COLORS 中添加**
   ```javascript
   const STATUS_COLORS = {
       // ...
       archived: "dark"  // 新增
   };
   ```

3. **在 PocketBase 中添加选项**
   - 编辑 status 字段，添加新选项 `archived`

4. **在筛选下拉框中会自动显示**
   - HTML 中的 status 下拉框从数据库读取选项

---

## 调试技巧

### 1. 查看控制台日志

```javascript
// 在 app.js 中已有大量日志输出
console.log("✓ DOM元素加载完成");
console.log("加载发票失败:", error);
console.warn("DOM元素未加载，重试...");
console.error("初始化失败");
```

**查看方式**: F12 → Console 标签

### 2. 检查应用状态

```javascript
// 在浏览器控制台输入
console.log(state);              // 查看应用状态
console.log(els);                // 查看 DOM 缓存
console.log(pb.authStore);       // 查看认证状态
```

### 3. API 调用监控

```javascript
// Network 标签可以查看所有 API 调用
// 检查:
// - 请求 URL
// - 请求参数
// - 响应状态 200/400/401 等
```

### 4. 手动测试

```javascript
// 在控制台执行测试代码
await pb.collection("invoices").getList(1, 10);  // 测试 API 连接
pb.authStore.isValid                               // 检查登录状态
state.selected.size                                // 检查选中数量
```

### 5. 性能分析

```javascript
// 使用 Performance 标签
console.time("loadInvoices");
await loadInvoices();
console.timeEnd("loadInvoices");

// 输出加载时间
// loadInvoices: 234ms
```

---

## 常见问题

### Q1: 页面显示旧版本

**原因**: 浏览器缓存或 CDN 缓存

**解决**:
- 清除浏览器缓存: Ctrl + Shift + Delete
- 或进行硬性刷新: Ctrl + Shift + R
- 或检查 `index.html` 中 app.js 的版本号

```html
<script src="js/app.js?v=1.0.1"></script>  <!-- 版本号更新 -->
```

### Q2: 登录失败

**原因**: 
- PocketBase 服务未运行
- 用户账户不存在
- 密码错误

**解决**:
1. 检查 PocketBase 是否运行: http://127.0.0.1:8090 访问是否正常
2. 查看浏览器控制台错误信息
3. 在 PocketBase 后台确认用户账户存在

### Q3: PDF 识别不工作

**原因**:
- PDF 文件不支持文本提取（扫描件）
- PDF.js 路径配置错误

**解决**:
1. 使用规范的电子发票（包含文本）
2. 检查 cmaps 文件是否存在
3. 检查 PDF.js 是否正确加载（F12 → Network）

### Q4: 附件上传失败

**原因**:
- PocketBase 文件存储配置
- 网络连接问题
- 文件大小限制

**解决**:
1. 检查 PocketBase 存储配置
2. 查看浏览器控制台 Network 标签
3. 尝试更小的文件

### Q5: 批量操作很慢

**原因**: 
- 网络延迟
- 选中过多发票

**解决**:
- 检查网络连接
- 分批处理（每批 50-100 条）
- 使用 `showLoader()` 提示用户正在处理

### Q6: 如何修改服务器地址？

```javascript
// 编辑 app.js 顶部的 CONFIG
const CONFIG = {
    PB_URL: "http://your-server.com",  // 改为你的地址
    // ...
};
```

---

## 版本发布

### 发布流程

1. **更新版本号**
   ```javascript
   // app.js 顶部的注释
   /* ============================================
      发票管理系统 - v1.0.2
      ============================================ */
   ```

2. **更新 index.html 中的脚本版本**
   ```html
   <script src="js/app.js?v=1.0.2"></script>
   ```

3. **更新 README.md 的版本记录**
   ```markdown
   ### v1.0.2 (2025-12-01)
   - 功能 A：描述
   - 修复 B：描述
   ```

4. **提交 git 提交**
   ```bash
   git add -A
   git commit -m "版本发布：1.0.1 → 1.0.2

   新增功能：
   - 功能 A
   - 功能 B

   修复问题：
   - 问题 X
   - 问题 Y"
   git push origin main
   ```

5. **部署到生产**
   - 构建 Docker 镜像
   - 上传到 Container Registry
   - 更新部署配置
   - 监控应用状态

### 语义化版本规则

- **Major** (主版本): 不兼容的 API 变更
- **Minor** (次版本): 向下兼容的新功能
- **Patch** (修订版): 向下兼容的问题修复

例: v1.0.1
- 1 = Major
- 0 = Minor
- 1 = Patch

---

## 快速参考

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + A` | 全选/取消全选 |
| `Ctrl + F` | 聚焦搜索框 |
| `Esc` | 取消选中 |

### 常用 API 调用

```javascript
// 获取发票列表
await pb.collection("invoices").getList(page, size, { sort: "-invoice_date" });

// 获取单条发票
await pb.collection("invoices").getOne(id);

// 创建发票
await pb.collection("invoices").create(data);

// 更新发票
await pb.collection("invoices").update(id, data);

// 删除发票
await pb.collection("invoices").delete(id);

// 获取文件 URL
pb.files.getURL(record, filename);

// 认证
await pb.collection("users").authWithPassword(email, password);

// 登出
pb.authStore.clear();
```

### 调试命令

```javascript
// 查看所有状态
console.table(state);

// 查看 DOM 缓存
console.table(els);

// 清除所有选择
deselectAll();

// 手动加载发票
loadInvoices();

// 显示提示
showToast("测试消息", 'success');
```

---

## 联系和支持

- **GitHub**: https://github.com/wwng2333/my-invoice
- **问题报告**: [Issues](https://github.com/wwng2333/my-invoice/issues)
- **讨论**: [Discussions](https://github.com/wwng2333/my-invoice/discussions)

---

**最后更新**: 2025年11月25日  
**维护者**: MyInvoice Team

