import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CUSTOM_THEME_STYLE_ID } from './theme-injector'
import {
  STORAGE_ACTIVE_THEME,
  STORAGE_CUSTOM_THEMES,
  useThemeManager,
} from './theme-manager'

describe('theme-manager', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove()
    useThemeManager.setState({
      activeThemeId: 'default',
      customThemes: [],
      contrastWarnings: [],
    })
  })

  afterEach(() => {
    window.localStorage.clear()
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove()
  })

  it('initializes with default theme', () => {
    const { activeThemeId, getActiveTheme } = useThemeManager.getState()
    expect(activeThemeId).toBe('default')
    expect(getActiveTheme()).toBeNull()
  })

  it('selects and activates a preset theme', () => {
    const { selectTheme, getActiveTheme } = useThemeManager.getState()
    selectTheme('dracula')

    expect(useThemeManager.getState().activeThemeId).toBe('dracula')
    const active = getActiveTheme()
    expect(active?.name).toBe('Dracula')

    // Verifies style element is injected
    const styleEl = document.getElementById(CUSTOM_THEME_STYLE_ID)
    expect(styleEl).not.toBeNull()
    expect(styleEl?.textContent).toContain('--background: #282a36 !important')
  })

  it('imports and activates a custom theme from JSON', () => {
    const customJson = JSON.stringify({
      id: 'custom-matrix',
      name: 'Matrix Green',
      variant: 'dark',
      colors: {
        background: '#0d1117',
        foreground: '#00ff66',
        card: '#161b22',
        cardForeground: '#00ff66',
        popover: '#161b22',
        popoverForeground: '#00ff66',
        primary: '#00ff66',
        primaryForeground: '#000000',
        secondary: '#21262d',
        secondaryForeground: '#00ff66',
        muted: '#21262d',
        mutedForeground: '#00aa44',
        accent: '#00ff66',
        accentForeground: '#000000',
        destructive: '#ff3333',
        border: '#30363d',
        input: '#30363d',
        ring: '#00ff66',
        sidebar: '#010409',
        sidebarForeground: '#00ff66',
      },
    })

    const { importTheme, getActiveTheme } = useThemeManager.getState()
    const imported = importTheme(customJson, 'matrix.json')

    expect(imported.id).toBe('custom-matrix')
    expect(useThemeManager.getState().activeThemeId).toBe('custom-matrix')
    expect(getActiveTheme()?.name).toBe('Matrix Green')

    // Verifies persistence in storage
    expect(window.localStorage.getItem(STORAGE_ACTIVE_THEME)).toBe(
      'custom-matrix'
    )
    const savedCustom = JSON.parse(
      window.localStorage.getItem(STORAGE_CUSTOM_THEMES) || '[]'
    )
    expect(savedCustom).toHaveLength(1)
    expect(savedCustom[0].id).toBe('custom-matrix')
  })

  it('deletes a custom theme and resets to default if active', () => {
    const { importTheme, deleteCustomTheme } = useThemeManager.getState()
    const sample = JSON.stringify({
      id: 'theme-to-delete',
      name: 'Temporary',
      variant: 'dark',
      colors: {
        background: '#111',
        foreground: '#eee',
        card: '#222',
        cardForeground: '#eee',
        popover: '#222',
        popoverForeground: '#eee',
        primary: '#33f',
        primaryForeground: '#fff',
        secondary: '#333',
        secondaryForeground: '#eee',
        muted: '#333',
        mutedForeground: '#888',
        accent: '#33f',
        accentForeground: '#fff',
        destructive: '#f33',
        border: '#444',
        input: '#444',
        ring: '#33f',
        sidebar: '#111',
        sidebarForeground: '#eee',
      },
    })

    importTheme(sample)
    expect(useThemeManager.getState().activeThemeId).toBe('theme-to-delete')

    deleteCustomTheme('theme-to-delete')
    expect(useThemeManager.getState().customThemes).toHaveLength(0)
    expect(useThemeManager.getState().activeThemeId).toBe('default')
    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).toBeNull()
  })

  it('exports theme with filename and content', () => {
    const { selectTheme, exportTheme } = useThemeManager.getState()
    selectTheme('dracula')

    const exported = exportTheme('dracula', 'json')
    expect(exported.filename).toBe('dracula.motrix-theme.json')
    expect(exported.content).toContain('Dracula')

    const base16Export = exportTheme('dracula', 'base16')
    expect(base16Export.filename).toBe('dracula.base16.json')
    expect(base16Export.content).toContain('base00')
  })
})
