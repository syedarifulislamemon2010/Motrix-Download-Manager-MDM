# Archive Auto-Extract

Motrix Turbo includes an automated archive extraction pipeline that triggers when downloads finish.

## Features

- **Format Support**:
  - **ZIP**: Extracted natively in pure JavaScript (streaming, zero native binaries needed).
  - **7-Zip (`.7z`) & RAR (`.rar`)**: Extracted by invoking a local 7-Zip (`7z` or `7z.exe`) executable.
- **Safety & Zip-Slip Protection**:
  - Strict prevention against path traversal (`..` escapes).
  - Windows reserved device name escaping (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
  - Windows long-path handling via `\\?\` extended prefixing.
  - Rejection of symlinks pointing outside target extraction directory.
  - Partial extraction cleanup upon unexpected failures.
- **Destination Modes**:
  - `subfolder`: Extracted into a dedicated subfolder matching the archive's base name.
  - `in_place`: Extracted directly into the current download directory.
- **Archive Cleanup**:
  - Optional `deleteArchiveAfterExtract` toggle to automatically remove the archive file after successful extraction.
- **Encrypted Archives**:
  - Pre-configurable password list automatically tested sequentially against password-protected archives.

## Configuration

Navigate to **Settings** > **Downloads** > **Archive auto-extract**:

- **Auto-extract completed archives**: Toggle the feature on or off.
- **Extraction destination**: Select `Subfolder` or `Current download folder`.
- **Supported formats**: Selectively enable or disable ZIP, 7-Zip, or RAR extraction.
- **Delete archive after extraction**: Automatically unlinks archive upon successful extraction.
- **7-Zip executable path**: Specify a custom path to `7z.exe`, or leave empty for auto-detection in standard Windows install directories or system `PATH`.
- **Extraction passwords**: Manage commonly used archive passwords.
