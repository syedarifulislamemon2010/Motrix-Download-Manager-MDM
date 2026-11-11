# URL Resolvers (Google Drive & Debrid)

Motrix Turbo supports URL resolving plugins executing in the sandboxed QuickJS hook runtime at the `beforeCreate` lifecycle stage. When new download tasks are initiated, matching plugins automatically transform host-specific web URLs, share links, and document links into direct download streams.

## Bundled Link Resolvers

Motrix Turbo ships with two built-in community resolvers located in `extra/plugins/`, which are automatically seeded into your local `plugins` directory upon startup:

### 1. Google Drive & Docs Resolver (`community.gdrive-resolver`)

- **Identifier**: `community.gdrive-resolver`
- **Supported Hosts**: `drive.google.com`, `docs.google.com`, `drive.usercontent.google.com`
- **Capabilities**:
  - **Google Workspace Documents**: Automatically converts Google Docs, Google Sheets, and Google Slides links into direct binary export links:
    - Docs: Exported as PDF or Microsoft Word (`docx`).
    - Sheets: Exported as Microsoft Excel (`xlsx`) or PDF.
    - Slides: Exported as Microsoft PowerPoint (`pptx`) or PDF.
  - **Large File Virus Scan Confirmation**: Automatically detects Google Drive's large file antivirus confirmation prompt and follows the confirmation token (`confirm=<token>`) to acquire the direct download stream.
  - **Quota Exceeded Detection**: Gracefully recognizes Google Drive download quota exceeded errors ("Too many users have viewed or downloaded this file recently") and halts or falls back safely based on user configuration.

### 2. Multi-Host Debrid Resolver (`community.debrid-resolver`)

- **Identifier**: `community.debrid-resolver`
- **Supported Providers**:
  - **Real-Debrid** (`https://api.real-debrid.com/rest/1.0/unrestrict/link`)
  - **AllDebrid** (`https://api.alldebrid.com/v4/link/unlock`)
  - **Premiumize** (`https://www.premiumize.me/api/transfer/create`)
- **Supported File Hosts**: Rapidgator, 1Fichier, Mega, Mediafire, Uploaded, Nitroflare, Turbobit, Filefactory, Uptobox, Ddownload, Katfile, Fikper, and dozens of other multi-host file lockers.
- **Capabilities**:
  - Automatically intercepts supported file-host URLs and queries your configured debrid account to produce an unrestricted, direct, multi-threaded high-speed download link.
  - Securely manages provider API tokens with encryption in settings.
  - Configurable fallback behavior: when unrestricting fails (e.g., account traffic limit reached), it can either stop cleanly with a descriptive error or fall back to the original URL.

## Configuration & Management

Link resolvers can be inspected, toggled, and configured in Motrix Turbo:

1. Open **Settings** > **Plugins** (or **Lab** > **Plugins**).
2. Find **Google Drive & Docs Resolver** or **Multi-Debrid Link Resolver**.
3. Enable or disable the plugin as desired.
4. Click **Settings** on the plugin card to customize preferences:
   - For **Debrid Resolver**: Select your active provider and enter your API Key / Token.
   - For **Google Drive Resolver**: Choose preferred document export formats (e.g., PDF or DOCX/XLSX/PPTX) and fallback behavior.
