# MyInvoice

这是一个基于 PocketBase 的发票管理应用，支持发票的增删改查、附件上传/删除、批量操作等功能。

## 功能

- 用户认证（登录/登出）
- 发票的添加、编辑、删除和搜索
- 附件上传、预览和删除（支持多个附件）
- 批量删除发票和下载附件
- 发票状态筛选（pending, approved, rejected）和搜索
- 总金额统计
- 文件存储(本地/S3) (S3 需要在 Pocketbase Dashboard 中配置)
- 自动备份(本地/S3) 
- **快捷键支持**:
  - `Ctrl + A`: 全选/取消全选所有发票
  - `Esc`: 取消选中所有发票
  - `Ctrl + F`: 聚焦到发票搜索框

## 技术栈

- **前端**: HTML, CSS (Bootstrap), JavaScript
- **后端**: PocketBase (数据库、文件存储和 API)
- **依赖**: Bootstrap, JSZip (用于 ZIP 下载), FileSaver.js (用于保存文件), PDF.js (用于识别发票中的税号)

## Docker 部署
```yaml
services:
  my-invoice:
    image: ghcr.io/wwng2333/my-invoice:latest
    container_name: my-invoice
    restart: unless-stopped
    environment:
      PB_HOST: 0.0.0.0
      PB_PORT: 8090
      TZ: Asia/Shanghai
    ports:
      - "5173:8090"
    volumes:
      - ./pb_data:/app/pb_data
      - ./pb_migrations:/app/pb_migrations
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://localhost:8090/api/health",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

```

## 手动部署

### 1. 安装 PocketBase
从 [Github](https://github.com/pocketbase/pocketbase/releases/) 下载最新版本的 PocketBase 可执行文件。

### 2. 配置 PocketBase
- 将 PocketBase 可执行文件放在项目根目录。
- 启动 PocketBase 服务：
  ```bash
  ./pocketbase serve
  ```
  默认地址： http://127.0.0.1:8090 。

### 3. 运行
- 在 PocketBase 后台 (http://127.0.0.1:8090/_/) 建立 `superuser` 和 `user`，`superuser` 用于后台管理，`user`为普通账户，用于前台登录。
- 通过 PocketBase 服务访问： http://127.0.0.1:8090/ ，使用上一步中建立的 users 账户登录。

## 贡献
欢迎提交 issue 或 pull request！如果有 bug 或改进建议，请随时反馈。

## 许可证
MIT License
