# Themes & Appearance

Motrix Turbo features an extensible theme system supporting curated presets, custom JSON themes, and universal **Base16** theme schemes.

## Built-in Presets

Motrix comes bundled with several popular community themes:

- **Dracula** (Dark)
- **Nord Dark & Nord Light**
- **Catppuccin Mocha** (Dark) & **Catppuccin Latte** (Light)
- **One Dark**
- **Solarized Dark**
- **GitHub Dark**
- **Tokyo Night**

## Importing & Exporting Themes

Navigate to **Settings** > **Appearance** > **Custom Themes & Presets**:

### Importing Themes
Click **Import Theme** to select a theme file:
1. **Motrix Theme JSON** (`.json`): Direct definition specifying semantic tokens (`background`, `foreground`, `primary`, `card`, `sidebar`, etc.).
2. **Base16 Scheme** (`.yaml`, `.yml`, `.json`): Any standard 16-color Base16 scheme (`base00` to `base0F`). The parser automatically maps standard Base16 terminal/editor colors to Motrix UI components and infers whether the scheme is light or dark.

### Exporting Themes
Click **Export JSON** or **Export Base16** to download the currently active theme:
- **Export JSON**: Saves the full Motrix semantic theme structure as `<theme-id>.motrix-theme.json`.
- **Export Base16**: Generates a standard Base16 color palette as `<theme-id>.base16.json` for interoperability with other Base16-compatible applications.

### WCAG 2.1 Contrast Checking
When a theme is loaded or imported, Motrix automatically analyzes the contrast ratio between text and surface backgrounds using W3C WCAG 2.1 relative luminance formulas. If any critical pair falls below the recommended 4.5:1 ratio (or 3.0:1 for large UI components), a non-blocking contrast warning notice is displayed.
