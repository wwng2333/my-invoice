# MyInvoice

这是一个基于 PocketBase 的发票管理应用，支持发票的增删改查、附件上传/删除、批量操作等功能。

**最新版本**: v1.0.1 | **状态**: ✅ 生产就绪

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
# 修改app.js中的CONFIG
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

## 🔧 配置说明

主要配置位置：`pb_public/js/app.js`

```javascript
const CONFIG = {
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

## 🔐 安全性

- ✅ XSS防护：所有用户输入都经过HTML转义
- ✅ 输入验证：表单提交前进行验证
- ✅ HTTPS：生产环境使用HTTPS
- ✅ 错误处理：不向用户暴露技术细节

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

如有建议或发现bug，请：
1. 检查[已有Issue](https://github.com/wwng2333/my-invoice/issues)
2. 创建新Issue或提交PR
3. 提供详细的问题描述

## 📝 更新日志

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

**最后更新**: 2025年11月25日 | **维护者**: [@wwng2333](https://github.com/wwng2333)
