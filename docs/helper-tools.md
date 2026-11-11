# Verified Helper Tools Management

Motrix Turbo provides native, secure lifecycle management for external extraction and scripting tools, including **yt-dlp**, **gallery-dl**, and **Deno**.

## Managed Helper Tools

1. **yt-dlp**
   - High-performance video and audio extractor supporting thousands of media hosting and streaming websites.
   - Pinned verified version: `2025.02.19`.
   - Windows binary: `yt-dlp.exe` (standalone executable).

2. **gallery-dl**
   - Image gallery, album, and manga downloader supporting hundreds of image hosting services and social platforms.
   - Pinned verified version: `1.28.5`.
   - Windows binary: `gallery-dl.exe` (standalone executable).

3. **Deno Runtime**
   - Secure, fast JavaScript and TypeScript runtime required by advanced URL resolvers and scraping scripts.
   - Pinned verified version: `v2.2.0`.
   - Windows binary: `deno.exe` (unpacked safely from verified zip distribution).

## Security & Verification Guarantees

- **Strict SHA-256 Verification**: Every downloaded asset has its cryptographic SHA-256 hash computed in a streaming pipeline and verified against hardcoded cryptographic release manifests. If a single byte deviates, the payload is immediately deleted.
- **Archive Extraction Safety (Zip-Slip Protection)**: Archive extractions strictly validate file entry boundaries, rejecting path traversal attempts (`..`), absolute paths, and Windows reserved device names (`CON`, `NUL`, `AUX`, etc.).
- **User Data Isolation**: Installed binaries reside inside the application data profile directory (`%APPDATA%\Motrix\binaries\<tool>\` on Windows, `~/.config/Motrix/binaries/<tool>/` on Linux/macOS) rather than altering global system directories.
- **Viability Preflight**: Before completing installation, the runtime executes `--version` with a strict 5-second timeout to verify executable integrity and retrieve verified version metadata.

## Configuration & Custom Binaries

You can monitor, install, and customize helper tools in **Settings** > **Integration** > **Helper Tools**:

- **Install / Update**: One-click download and verification directly within the application.
- **Custom Executable Path**: If you already have your own compiled or system-wide copy of `yt-dlp`, `gallery-dl`, or `deno`, expand **Custom Path** and specify your executable.
- **Environment Variables**: Motrix automatically checks standard environment variables when custom paths are unconfigured:
  - `MOTRIX_YTDLP_BIN`
  - `MOTRIX_GALLERYDL_BIN`
  - `MOTRIX_DENO_BIN`
