# MyInvoice

这是一个基于 PocketBase 的发票管理应用，支持发票的增删改查、附件上传/删除、批量操作等功能。

**最新版本**: v1.1.0 | **状态**: ✅ 生产就绪

## ✨ 核心功能

- ✅ **用户认证** - 安全的登录/登出
- ✅ **发票管理** - 添加、编辑、删除、搜索、状态筛选
- ✅ **附件处理** - 上传、预览、批量下载（支持ZIP格式）
- ✅ **批量操作** - 批量删除、批量修改状态、批量下载
- ✅ **PDF识别** - 自动识别发票号、金额、日期（支持中文大写）
- ✅ **统计分析** - 金额统计、状态分布
- ✅ **快捷键支持**:
  - `Ctrl + A`: 全选/取消全选
  - `Ctrl + F`: 快速搜索
  - `Esc`: 取消选中

## 🎯 最近改进 (v1.0.1)

### 代码优化
- 🔄 完整的代码重构，模块化设计
- 📝 添加JSDoc文档（覆盖率60%）
- 🔒 实现XSS防护和输入验证
- ⚡ 性能优化（缓存破坏、DOM缓存）

### 文档完善
- 📄 [优化详情报告](./OPTIMIZATION_REPORT.md)
- 📖 [开发指南](./DEVELOPMENT_GUIDE.md)
- 💡 代码注释更详细清晰

### 安全增强
- 🛡️ HTML转义防止XSS
- ✔️ 用户输入验证
- 🔄 完善的错误处理

## 🩺 最近修复 (2026-06-23)

- 🛡️ **修复 PDF 中文乱码**：`pdfjsLib.getDocument` 调用不再传入不存在的本地 `./cmaps/`，恢复使用 `index.html` 中设置的全局 CDN cMapUrl 配置，避免中文 PDF 识别为乱码。
- 🔢 **修复金额正则误匹配**：金额正则中的单独字符 `计` 会匹配"合计/总计/会计/统计"等，已替换为 `价税合计/小计` 等更精确的关键词。
- 🔢 **修复发票号宽松匹配过宽**：原来的 `\d{20}` 和 `\d{10,12}` 会把日期、电话、金额串接等数字误判为发票号；已收紧为 8/12 位并优先匹配关键词上下文。
- 🖼️ **修复默认头像 SVG 首字母未转义**：本地生成的 SVG data URI 中首字母未做 HTML 转义，已加上 `escapeHtml` 作为防御性 XSS 防护。
- 💾 **修复空归属被覆盖为 "Default"**：编辑发票时 `r.attribution || "Default"` 会把用户显式设置的空字符串改为 "Default"，已改为 `??` 仅在 null/undefined 时填默认值。
- 🔐 **加固 PocketBase 过滤器注入**：新增 `escapeFilter` 工具函数，搜索与归属过滤统一剥离控制字符并转义 `\`、`"`，避免破坏过滤表达式。

## 🩺 最近修复 (2026-03-12)

- 🛡️ **修复 showToast XSS 漏洞**：改用 DOM API + `textContent` 替代 `innerHTML` 拼接消息，防止恶意内容注入。
- 🔐 **修复附件文件名 XSS**：附件预览区改用 DOM API 构建元素，文件名通过 `textContent` 赋值。
- 🔍 **修复搜索过滤器注入**：对搜索词中的 `\` 和 `"` 进行转义，防止 PocketBase 过滤语句被篡改。
- 🏗️ **解耦 API 层与 DOM**：`getInvoices()` 改为接受参数，不再直接读取 DOM 元素，提升可测试性。
- ⚡ **修复竞态条件**：新增请求版本号 `loadRequestId`，过时的列表响应直接丢弃，避免旧数据覆盖新数据。
- 🔄 **修复批量删除后列表不刷新**：无论删除成功与否均调用 `loadInvoices()`；只要有任意一条成功即清空选中状态。
- 📝 **修复编辑表单使用旧数据**：`openModal` 统一使用从服务端拉取的完整记录（`currentRecord`）填充表单字段。
- 🔢 **修复金额浮点精度**：勾选/取消发票时对 `totalAmount` 使用 `toFixed(2)` 修正，避免 `0.1 + 0.2 ≠ 0.3` 等问题。
- 🖼️ **移除第三方头像服务**：不再向 `ui-avatars.com` 发送用户邮箱，改为本地生成 SVG data URI 首字母头像。
- 🌐 **统一界面语言**：将所有残留的英文提示（登录、删除、识别等）统一替换为中文。

## 🩺 历史修复 (2026-03-11)

- 🔐 修复 cookie 过期后不跳转登录页的问题：API 请求收到 401 时，自动清除本地认证状态并跳回登录页，同时提示"登录已过期，请重新登录"。

## 🩺 历史修复 (2026-03-03)

- 🔧 修复模块循环依赖：将 `CONFIG` 提取到 `pb_public/js/config.js`，避免 `app.js` 与 `api.js` 的静态循环导入导致未初始化错误。
- 🧭 修正时序问题：将 `flatpickr` 的初始化从模块顶层移动到 `safeInitialize()`，确保 DOM 元素就绪后再初始化日期选择器。
- 🔁 减少模块耦合：将 `ui.js` 中的 `STATUS_MAP` 与 `STATUS_COLORS` 导出，且将 `api.js` 中对通知（toast）的静态依赖改为按需动态导入，打破 `api ↔ ui` 的双向静态依赖。
- ✅ 增加空值保护：`api.saveInvoice()` 在访问 `getAuthModel().id` 前做了登录检测，避免未登录时抛出异常。

## 🛠️ 技术栈

| 技术 | 说明 |
|------|------|
| **前端** | HTML5, CSS3 (Bootstrap 5.3), Vanilla JavaScript |
| **后端** | PocketBase (数据库、文件存储、API) |
| **UI框架** | Bootstrap 5.3.8, Bootstrap Icons |
| **库** | PDF.js, JSZip, FileSaver.js, Flatpickr |
| **部署** | Docker, Cloudflare CDN |

## 🚀 快速开始

### Docker 部署（推荐）
```yaml
services:
  my-invoice:
    image: ghcr.io/wwng2333/my-invoice:main
    container_name: my-invoice
    restart: unless-stopped
    environment:
      PB_HOST: 0.0.0.0
      PB_PORT: 8090
      TZ: Asia/Shanghai
    ports:
      - "8090:8090"
    volumes:
      - ./pb_data:/app/pb_data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### 手动部署

#### 1. 安装 PocketBase
从 [官方Github](https://github.com/pocketbase/pocketbase/releases/) 下载最新版本

#### 2. 启动服务
```bash
./pocketbase serve
```
访问地址：http://127.0.0.1:8090

#### 3. 初始化
- 在后台 (http://127.0.0.1:8090/_/) 创建superuser和user账户
- 通过 http://127.0.0.1:8090/ 使用创建的账户登录

### 本地开发
```bash
# 修改 pb_public/js/config.js 中的 PB_URL
const CONFIG = {
    PB_URL: "http://127.0.0.1:8090",
    // ...
};

# 启动PocketBase
./pocketbase serve

# 访问
http://127.0.0.1:8090/
```

## 📁 项目结构

```
my-invoice/
├── pb_public/                    # 前端文件
│   ├── index.html               # 主页面
│   ├── js/
│   │   └── app.js               # 应用程序（1100+ 行，优化版）
│   └── cmaps/                   # PDF字体映射
├── pb_migrations/               # 数据库迁移脚本
├── README.md                    # 本文件
├── OPTIMIZATION_REPORT.md       # 优化详情报告
├── DEVELOPMENT_GUIDE.md         # 开发指南
└── LICENSE                      # MIT许可证
```

## 📖 文档

| 文档 | 说明 |
|------|------|
| [OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md) | 详细的代码优化报告，包含改进对比 |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | 开发指南，包含函数参考和快速上手 |



## 🐛 故障排查

### 页面显示旧版本
- 清除浏览器缓存
- 或者在开发者工具中进行硬性刷新：`Ctrl + Shift + R`

### 登录失败
- 检查PocketBase服务是否运行
- 检查浏览器控制台(F12)是否有错误信息
- 确认用户账户已创建

### PDF识别不工作
- 检查PDF文件是否有效
- 查看浏览器控制台错误信息
- 确保PDF.js已正确加载

## 🔧 配置说明

主要配置位置：`pb_public/js/config.js`（已从 `app.js` 提取以避免循环依赖）

```javascript
// pb_public/js/config.js
export const CONFIG = {
  PB_URL: "https://invoice.csgo.ovh/",  // PocketBase服务器地址
  TIMEOUT: {
    INIT_RETRY: 500,      // DOM初始化重试间隔(ms)
    INIT_DELAY: 100,      // 初始化延迟(ms)
    SEARCH_DEBOUNCE: 300  // 搜索防抖延迟(ms)
  },
  PAGE_SIZES: [10, 25, 50, 9999],
  RETRY_MAX: 3              // 最大重试次数
};
```
## 📝 更新日志

### v1.1.0 (2026-10-24) — 前端优化
- 🐛 **修复 flatpickr 中文语言包 SRI 哈希错误**：原 `index.html` 中 `l10n/zh.min.js` 的 integrity 哈希与实际文件不匹配（少一个字符），语言包从未加载成功，日期选择器一直显示英文界面。已用实际文件重新计算修正。
- 🖼️ **头像加载失败自动降级**：用户头像文件在服务端缺失（404）时，自动回退到本地生成的首字母头像，不再显示破图。
- ⚡ **按需加载重型库**：PDF.js、JSZip、FileSaver、flatpickr（约 470KB）不再阻塞首屏，改为首次使用时动态加载（新增 `js/modules/loaders.js`，SRI 完整性校验保持不变）。
- ⚡ **脚本 defer 化**：Bootstrap 与 PocketBase SDK 加上 `defer` 并行下载，并新增 CDN `preconnect` 预连接。
- 🌙 **修复深色模式闪白**：主题检测脚本移至 `<head>`，主题类名挂到 `<html>` 上，深色用户首屏即为深色，不再出现浅色闪烁。
- 🔍 **搜索体验**：输入内容后出现一键清空按钮；在搜索框内按 `Esc` 清空搜索并退出焦点。
- 📄 **分页信息**：分页栏新增"共 N 条记录 · 第 X / Y 页"提示。
- ⌨️ **快捷键优化**：`Ctrl + F` 聚焦搜索并全选已有文字便于直接替换；确认删除弹窗打开时不再误触发全局快捷键；焦点在输入框内时 `Esc` 不再误清空选中状态。
- 🖼️ **新增页面图标（favicon）**：内联 SVG，不产生额外请求。
- 🛡️ **加载遮罩兜底**：模块加载异常时 8 秒后自动隐藏遮罩，避免页面被永久遮挡。
- ♿ **无障碍**：尊重系统"减少动态效果"设置（`prefers-reduced-motion`），并为清空按钮补充 `aria-label`。
- 🌐 **统一界面语言**：批量下载失败提示改为中文。

### v1.0.5 (2026-06-23)
- 🛡️ **修复 PDF 中文乱码**：`getDocument` 调用不再传入不存在的 `./cmaps/` 覆盖 `index.html` 中的全局 CDN cMapUrl 配置。
- 🔢 **修复金额正则误匹配**：将 `计` 替换为 `价税合计/小计`，避免误匹配"合计/总计/会计/统计"等。
- 🔢 **修复发票号宽松匹配过宽**：将 `\d{20}` 与 `\d{10,12}` 收紧为 `\d{8}|\d{12}`，并优先靠近"发票号码"关键词。
- 🖼️ **修复默认头像 SVG 首字母未转义**：对 `initial` 应用 `escapeHtml`，防御性 XSS 防护。
- 💾 **修复空归属被覆盖为 "Default"**：将 `||` 改为 `??`，仅 null/undefined 时使用默认值，保留用户显式设置的空字符串。
- 🔐 **加固 PocketBase 过滤器注入**：新增 `escapeFilter` 工具函数，统一剥离控制字符并转义 `\`、`"`。

### v1.0.3 (2026-03-12)
- 🛡️ 修复 showToast / 附件文件名 XSS 漏洞
- 🔐 修复搜索过滤器注入
- 🏗️ 解耦 API 层与 DOM
- ⚡ 修复竞态条件、批量删除不刷新、编辑表单用旧数据
- 🔢 修复金额浮点精度
- 🖼️ 移除第三方头像服务，本地生成头像
- 🌐 统一界面语言为中文

### v1.0.2 (2026-03-11)
- 🔐 修复 cookie 过期后不自动跳回登录页的问题

### v1.0.1 (2025-11-25)
- 🔄 完整代码重构，模块化设计
- 📝 添加JSDoc文档注释
- 🛡️ 实现XSS防护
- ⚡ 性能优化
- 📖 补充开发文档

### v1.0.0
- 初始版本

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

**需要帮助？** 查看 [开发指南](./DEVELOPMENT_GUIDE.md) 或提交 [Issue](https://github.com/wwng2333/my-invoice/issues)

**最后更新**: 2026年10月24日 | **维护者**: [@wwng2333](https://github.com/wwng2333)
