# Internet Download Manager (.ef2) File Import

Motrix Turbo includes built-in support for parsing and importing download queues and links exported from **Internet Download Manager (IDM)** via `.ef2` (IDM Export File) format.

---

## What is an `.ef2` File?

Internet Download Manager uses `.ef2` files to export batches of download tasks, preserving essential contextual information:
- **Download URLs**: Direct HTTP, HTTPS, or FTP target addresses.
- **Referrer URLs (`referer:`)**: The source page context required by CDNs and protected download portals.
- **Session Cookies (`cookie:`)**: Authentication and session cookies required by login-gated file hosts.
- **User-Agent (`User-Agent:`)**: Browser identity strings to avoid anti-bot blocks.
- **Destination Paths (`filepath:`)** & **Custom Filenames (`filename:`)**: Target folders and specific output file names.

---

## File Format Structure

An `.ef2` file contains plain-text records delimited by angle brackets (`<` and `>`):

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

## Security & Privacy Protections

Motrix Turbo enforces strict security constraints when importing `.ef2` files:

1. **WeakMap Credential Isolation**:
   Authentication tokens, session cookies, and private request headers are parsed into secure in-memory `WeakMap` storage. They are never serialized into logs, public IPC DTOs, or telemetry.
2. **Path Traversal Protection**:
   File paths (`filepath:`) and file names (`filename:`) are strictly validated against Windows reserved device names (`CON`, `NUL`, `AUX`, `COM1-9`, `LPT1-9`) and directory traversal sequences (`..`). Invalid paths are safely ignored or quarantined.
3. **User Authorization Gate**:
   Tasks that require sensitive request headers or cookies are flagged with `request-settings-required` so users explicitly review imported credentials before execution.
4. **Input Size Budget**:
   Import files are constrained to 8 MB (`MAX_LEGACY_BYTES`) and up to 10,000 tasks (`MAX_LEGACY_ITEMS`) to protect against resource exhaustion attacks.
