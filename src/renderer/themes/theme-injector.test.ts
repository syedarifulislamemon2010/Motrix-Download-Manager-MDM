import type { MotrixTheme } from '@shared/schemas/theme'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyCustomThemeCss,
  CUSTOM_THEME_STYLE_ID,
  generateThemeCss,
} from './theme-injector'

describe('theme-injector', () => {
  const sampleTheme: MotrixTheme = {
    id: 'test-dracula',
    name: 'Dracula',
    variant: 'dark',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      card: '#21222c',
      cardForeground: '#f8f8f2',
      popover: '#21222c',
      popoverForeground: '#f8f8f2',
      primary: '#bd93f9',
      primaryForeground: '#282a36',
      secondary: '#44475a',
      secondaryForeground: '#f8f8f2',
      muted: '#44475a',
      mutedForeground: '#6272a4',
      accent: '#ff79c6',
      accentForeground: '#282a36',
      destructive: '#ff5555',
      border: '#44475a',
      input: '#44475a',
      ring: '#bd93f9',
      sidebar: '#1e1f29',
      sidebarForeground: '#f8f8f2',
    },
  }

  beforeEach(() => {
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove()
  })

  afterEach(() => {
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove()
  })

  it('generates css with all semantic variables', () => {
    const css = generateThemeCss(sampleTheme)
    expect(css).toContain('--background: #282a36 !important')
    expect(css).toContain('--foreground: #f8f8f2 !important')
    expect(css).toContain('--primary: #bd93f9 !important')
    expect(css).toContain('--sidebar: #1e1f29 !important')
  })

  it('applies custom theme into DOM head', () => {
    applyCustomThemeCss(sampleTheme)
    const element = document.getElementById(CUSTOM_THEME_STYLE_ID)
    expect(element).not.toBeNull()
    expect(element?.textContent).toContain('--primary: #bd93f9 !important')
  })

  it('removes style element when theme is null or default', () => {
    applyCustomThemeCss(sampleTheme)
    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).not.toBeNull()

    applyCustomThemeCss(null)
    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).toBeNull()

    applyCustomThemeCss(sampleTheme)
    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).not.toBeNull()

    applyCustomThemeCss({ ...sampleTheme, id: 'default' })
    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).toBeNull()
  })
})
