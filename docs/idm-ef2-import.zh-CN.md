# Internet Download Manager (.ef2) 导出文件导入

Motrix Turbo 原生支持解析和导入 **Internet Download Manager (IDM)** 的 `.ef2` 格式导出文件，无缝迁移下载队列与任务链接。

---

## 什么是 `.ef2` 文件？

IDM 使用 `.ef2` 文本文件来备份或共享下载任务列表，该格式完整保留了任务下载所必需的关键上下文信息：
- **下载地址 (URL)**：HTTP、HTTPS 或 FTP 目标资源链接。
- **来源引用地址 (`referer:`)**：下载页面上下文，防止防盗链与 CDN 校验失败。
- **会话 Cookie (`cookie:`)**：登录态身份验证凭证，支持带授权会话的资源下载。
- **浏览器标识 (`User-Agent:`)**：模拟浏览器请求头，避免被下载服务器判定为爬虫。
- **保存目录 (`filepath:`)** 与 **指定文件名 (`filename:`)**：保留原有的目标存储路径与重命名配置。

---

## 文件格式结构

`.ef2` 文件由尖括号（`<` 和 `>`）包裹的纯文本记录块组成：

```text
<
https://example.com/downloads/setup.exe
referer: https://example.com/download-page
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Cookie: download_token=abc123xyz
filepath: D:\Downloads\
filename: custom_setup.exe
>
```

---

## 安全与隐私保障

在导入 `.ef2` 文件时，Motrix Turbo 执行严格的安全校验规范：

1. **WeakMap 凭证隔离**：
   解析提取的身份验证 Token、Cookie 和自定义私有请求头均受控保存在内存 `WeakMap` 中，绝不会序列化到日志、公开 IPC 数据包或界面状态中。
2. **防路径穿越与设备名校验**：
   目标路径 (`filepath:`) 与文件名 (`filename:`) 会进行严格的路径校验，彻底拦截 Windows 保留设备名称（`CON`、`NUL`、`AUX`、`COM1-9`、`LPT1-9` 等）以及目录回溯符（`..`），非法路径将被自动忽略或拦截。
3. **敏感凭证确认拦截**：
   凡带有私有 Cookie 或请求头配置的导入项，均会被赋予 `request-settings-required` 状态标记，确保用户知情并在启动前完成复核。
4. **资源预算保护**：
   导入文件严格受限于 8 MB (`MAX_LEGACY_BYTES`) 内存预算与最多 10,000 个条目 (`MAX_LEGACY_ITEMS`)，防范畸形超大文件拒绝服务攻击。
