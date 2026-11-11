# URL 解析器（Google Drive 与 Debrid）

Motrix Turbo 支持在沙箱化 QuickJS Hook 运行时中通过 `beforeCreate` 生命周期阶段执行 URL 解析插件。当创建新下载任务时，匹配的插件会自动将特定网盘链接、分享链接和在线文档链接解析转换为直链高速下载流。

## 内置链接解析器

Motrix Turbo 在 `extra/plugins/` 目录中预置了两个社区链接解析插件，首次启动时会自动释放（Seed）至本地用户插件目录：

### 1. Google Drive 与 Docs 解析器 (`community.gdrive-resolver`)

- **插件标识符**：`community.gdrive-resolver`
- **支持域名**：`drive.google.com`, `docs.google.com`, `drive.usercontent.google.com`
- **功能特性**：
  - **Google Workspace 文档解析**：自动将 Google Docs、Google Sheets 和 Google Slides 网页链接解析为直接导出文件：
    - Docs：导出为 PDF 或 Microsoft Word (`docx`)。
    - Sheets：导出为 Microsoft Excel (`xlsx`) 或 PDF。
    - Slides：导出为 Microsoft PowerPoint (`pptx`) 或 PDF。
  - **大文件病毒扫描确认跳过**：自动检测 Google Drive 大文件防病毒扫描确认页面，并解析传递确认令牌 (`confirm=<token>`)，直接获取下载文件流。
  - **配额超限检测**：友好识别 Google Drive 下载配额超限提示（“查看或下载此文件的用户过多”），根据用户配置决定安全终止或保留原链接。

### 2. 多合一 Debrid 解析器 (`community.debrid-resolver`)

- **插件标识符**：`community.debrid-resolver`
- **支持服务商**：
  - **Real-Debrid** (`https://api.real-debrid.com/rest/1.0/unrestrict/link`)
  - **AllDebrid** (`https://api.alldebrid.com/v4/link/unlock`)
  - **Premiumize** (`https://www.premiumize.me/api/transfer/create`)
- **支持网盘与网赚盘**：Rapidgator、1Fichier、Mega、Mediafire、Uploaded、Nitroflare、Turbobit、Filefactory、Uptobox、Ddownload、Katfile、Fikper 等数十种网盘。
- **功能特性**：
  - 自动拦截支持的网盘文件链接，调用已配置的 Debrid 账号服务生成无限制、多线程高速直链。
  - 安全加密存储服务商 API 密钥与凭据。
  - 可配置的降级处理：当解析失败时（如服务商配额耗尽），可清晰提示错误或安全降级回原始链接。

## 配置与管理

可以在 Motrix Turbo 界面中查看、开关与配置链接解析器：

1. 打开 **设置** > **插件**（或 **实验室** > **插件**）。
2. 找到 **Google Drive 与文档解析器** 或 **Debrid 多服务商解析器**。
3. 按需启用或停用插件。
4. 点击插件卡片上的 **设置** 按钮调整专属选项：
   - **Debrid 解析器**：选择激活的服务商并输入对应的 API Key / Token。
   - **Google Drive 解析器**：选择文档导出的格式偏好（如 PDF 或 Office 格式）以及失败降级策略。
