# Crash Reporting & Diagnostics

Motrix provides a privacy-first crash reporting workflow designed to make bug reporting fast, diagnostic, and safe from credential or personal data leaks.

## Features

- **Pre-filled GitHub Issue URL**:
  - Automatically formats runtime error information, OS architecture, app version, portable mode status, and stack traces into standard Markdown issue templates.
  - Generates a direct `https://github.com/agalwood/Motrix/issues/new?title=...&body=...` link that opens in the user's default browser with a single click.
- **Privacy & Path Redaction**:
  - Automatically scrubs personal Windows user profile directories (`C:\Users\<user>\` -> `C:\Users\<redacted-user>\`), macOS user paths (`/Users/<user>/`), and Linux user paths (`/home/<user>/`).
  - Redacts sensitive credentials, including aria2 RPC secrets (`--rpc-secret`), Authorization Bearer tokens, API keys, and sensitive URL query tokens (`token=`, `access_token=`, `secret=`).
- **Safe Truncation Algorithm**:
  - Browser query URLs enforce safe length boundaries (~7,000 characters). An exact binary-fit algorithm ensures Markdown diagnostics fit gracefully within the maximum URL limit without truncation errors.
- **Integrated Surfaces**:
  - **Application Menu**: `Help` -> `Report Problem` launches the diagnostic reporting workflow.
  - **About Dialog**: Quick "Report an issue" action in the resources menu.
  - **Renderer Recovery**: Accessible via "Report on GitHub" from the fallback screen when an unhandled renderer crash occurs.
  - **Route Failure Boundary**: Allows reporting unhandled navigation errors directly from the failure UI.
