# Motrix AI Assistant (MCP) Integration

Motrix includes built-in support for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), allowing external AI assistants—such as Claude Desktop, Cursor, and Cline—to monitor, inspect, and manage downloads safely through natural language.

---

## Architecture & Security Tiers

To safeguard user privacy and disk contents, Motrix enforces a strict three-tier permission model and an in-memory audit log.

### Permission Tiers

| Tier | Name | Allowed Tools | Description |
| :--- | :--- | :--- | :--- |
| 1 | `read_only` | `motrix_list_tasks`<br>`motrix_get_task`<br>`motrix_get_stats`<br>`motrix_get_engine_status` | Inspect active, queued, or completed downloads and engine status without modifying anything. |
| 2 | `standard` | All `read_only` tools, plus:<br>`motrix_add_task`<br>`motrix_pause_task`<br>`motrix_resume_task` | Add new URLs/magnets/torrents, pause, and resume tasks. |
| 3 | `full` | All `standard` tools, plus:<br>`motrix_remove_task`<br>`motrix_set_speed_limit` | Full control over download lifecycle and bandwidth allocation. |

> [!IMPORTANT]
> **Disk Protection Guard**: Even under the `full` permission tier, deleting downloaded files from disk (`deleteFiles: true`) is blocked unless the user explicitly turns on **Allow deleting downloaded files from disk** in **Settings → Integration → AI Assistant (MCP)**.

---

## Tool Reference

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `motrix_list_tasks` | `status?: 'active' \| 'waiting' \| 'paused' \| 'error' \| 'complete' \| 'removed'` | Returns a list of tasks with GID, name, size, progress, and speed. |
| `motrix_get_task` | `gid: string` | Retrieves detailed information for a single download task. |
| `motrix_get_stats` | None | Returns global download and upload speed and task counters. |
| `motrix_get_engine_status` | None | Reports aria2 core engine status and version. |
| `motrix_add_task` | `uris: string[]`, `dir?: string`, `out?: string`, `split?: number` | Enqueues a new download task. |
| `motrix_pause_task` | `gid: string` | Pauses an active download task. |
| `motrix_resume_task` | `gid: string` | Resumes a paused download task. |
| `motrix_remove_task` | `gid: string`, `deleteFiles?: boolean` | Removes a task from the download list (and optionally removes files if permitted). |
| `motrix_set_speed_limit` | `gid?: string`, `downloadLimit?: number`, `uploadLimit?: number` | Adjusts global or task-specific download/upload bandwidth limits. |

---

## Configuration

### Claude Desktop

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

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

On Windows, the configuration is located at:
`%APPDATA%\Claude\claude_desktop_config.json`

---

## Audit Log

Every tool call dispatched by an AI assistant is validated against the active permission tier and recorded in the Motrix Activity Audit Log. Users can view recent invocations, inspecting parameters, execution status, and timestamps directly in **Settings → Integration → AI Assistant (MCP)**. Sensitive credentials (such as passwords, tokens, and basic auth headers in URIs) are automatically redacted prior to storage.
