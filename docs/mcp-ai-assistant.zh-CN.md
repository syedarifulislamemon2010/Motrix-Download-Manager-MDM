# Motrix AI 助手 (MCP) 集成

Motrix 原生支持 [模型上下文协议 (Model Context Protocol, MCP)](https://modelcontextprotocol.io/)，允许 Claude Desktop、Cursor、Cline 等外部 AI 助手通过自然语言安全监控、查询和管理下载任务。

---

## 架构与安全权限级别

为了保护用户隐私与本地磁盘安全，Motrix 实现了三级权限模型以及内存审计日志。

### 权限级别

| 级别 | 标识 | 允许使用的工具 | 说明 |
| :--- | :--- | :--- | :--- |
| 1 | `read_only` | `motrix_list_tasks`<br>`motrix_get_task`<br>`motrix_get_stats`<br>`motrix_get_engine_status` | 仅查看活跃、等待中或已完成的任务与引擎状态，不执行任何更改。 |
| 2 | `standard` | 包含 `read_only` 工具，以及：<br>`motrix_add_task`<br>`motrix_pause_task`<br>`motrix_resume_task` | 添加新链接/磁力/种子，暂停以及恢复下载任务。 |
| 3 | `full` | 包含 `standard` 工具，以及：<br>`motrix_remove_task`<br>`motrix_set_speed_limit` | 完全控制下载生命周期与带宽分配。 |

> [!IMPORTANT]
> **磁盘保护机制**：即便处于 `full` 完全控制级别，若用户未在 **设置 → 扩展集成 → AI 助手 (MCP)** 中显式开启 **允许从磁盘删除已下载的文件**，从磁盘删除文件 (`deleteFiles: true`) 的请求将被严格拦截阻止。

---

## 工具接口参考

| 工具名称 | 参数 | 说明 |
| :--- | :--- | :--- |
| `motrix_list_tasks` | `status?: 'active' \| 'waiting' \| 'paused' \| 'error' \| 'complete' \| 'removed'` | 列出任务及其 GID、名称、文件大小、进度与速度。 |
| `motrix_get_task` | `gid: string` | 查询单个下载任务的详细信息。 |
| `motrix_get_stats` | 无 | 返回全局下载/上传速率及任务计数统计。 |
| `motrix_get_engine_status` | 无 | 查看 aria2 核心引擎运行状态与版本。 |
| `motrix_add_task` | `uris: string[]`, `dir?: string`, `out?: string`, `split?: number` | 添加新的下载任务。 |
| `motrix_pause_task` | `gid: string` | 暂停指定的下载任务。 |
| `motrix_resume_task` | `gid: string` | 恢复已暂停的下载任务。 |
| `motrix_remove_task` | `gid: string`, `deleteFiles?: boolean` | 从列表中移除下载任务（若经允许可同时删除磁盘文件）。 |
| `motrix_set_speed_limit` | `gid?: string`, `downloadLimit?: number`, `uploadLimit?: number` | 调整全局或单任务下载/上传带宽上限。 |

---

## 配置指南

### Claude Desktop

将以下内容添加到 Claude Desktop 配置文件 (`claude_desktop_config.json`)：

```json
{
  "mcpServers": {
    "motrix": {
      "command": "motrix",
      "args": ["mcp"]
    }
  }
}
```

在 Windows 上，该配置文件位于：
`%APPDATA%\Claude\claude_desktop_config.json`

---

## 审计日志

AI 助手调用的每一次工具请求都会经过权限检查，并完整记录于 Motrix 活动审计日志中。用户可以在 **设置 → 扩展集成 → AI 助手 (MCP)** 中直接查看最近的调用工具、参数摘要、状态与时间戳。敏感信息（如链接中的密码、Token 和身份凭证）会在存入日志前自动进行脱敏处理。
