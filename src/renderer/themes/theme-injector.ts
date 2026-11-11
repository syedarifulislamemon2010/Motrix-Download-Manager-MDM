import type { MotrixTheme } from '@shared/schemas/theme'

export const CUSTOM_THEME_STYLE_ID = 'motrix-custom-theme'

export function generateThemeCss(theme: MotrixTheme): string {
  const c = theme.colors
  const sidebarPrimary = c.sidebarPrimary ?? c.primary
  const sidebarPrimaryFg = c.sidebarPrimaryForeground ?? c.primaryForeground
  const sidebarBorder = c.sidebarBorder ?? c.border

  return `
/* Motrix Custom Theme: ${theme.name} (${theme.variant}) */
:root, .dark, .light {
  --background: ${c.background} !important;
  --foreground: ${c.foreground} !important;
  --card: ${c.card} !important;
  --card-foreground: ${c.cardForeground} !important;
  --popover: ${c.popover} !important;
  --popover-foreground: ${c.popoverForeground} !important;
  --primary: ${c.primary} !important;
  --primary-foreground: ${c.primaryForeground} !important;
  --secondary: ${c.secondary} !important;
  --secondary-foreground: ${c.secondaryForeground} !important;
  --muted: ${c.muted} !important;
  --muted-foreground: ${c.mutedForeground} !important;
  --accent: ${c.accent} !important;
  --accent-foreground: ${c.accentForeground} !important;
  --destructive: ${c.destructive} !important;
  --border: ${c.border} !important;
  --input: ${c.input} !important;
  --ring: ${c.ring} !important;
  --sidebar: ${c.sidebar} !important;
  --sidebar-foreground: ${c.sidebarForeground} !important;
  --sidebar-primary: ${sidebarPrimary} !important;
  --sidebar-primary-foreground: ${sidebarPrimaryFg} !important;
  --sidebar-border: ${sidebarBorder} !important;
}
`
}

export function applyCustomThemeCss(theme: MotrixTheme | null): void {
  if (typeof document === 'undefined') return

  const existing = document.getElementById(CUSTOM_THEME_STYLE_ID)

  if (!theme || theme.id === 'default') {
    existing?.remove()
    return
  }

  const css = generateThemeCss(theme)
  if (existing) {
    existing.textContent = css
  } else {
    const style = document.createElement('style')
    style.id = CUSTOM_THEME_STYLE_ID
    style.textContent = css
    document.head.appendChild(style)
  }
}
