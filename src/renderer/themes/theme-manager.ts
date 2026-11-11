import {
  type ContrastValidationResult,
  type MotrixTheme,
  validateThemeContrast,
} from '@shared/schemas/theme'
import { create } from 'zustand'
import { PRESET_THEMES } from './presets'
import { applyCustomThemeCss } from './theme-injector'
import { exportThemeToFile, parseThemeFileContent } from './theme-parser'

export const STORAGE_ACTIVE_THEME = 'motrix-active-theme-id'
export const STORAGE_CUSTOM_THEMES = 'motrix-custom-themes'

function loadCustomThemesFromStorage(): MotrixTheme[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_CUSTOM_THEMES)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCustomThemesToStorage(themes: MotrixTheme[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_CUSTOM_THEMES, JSON.stringify(themes))
  } catch {
    // Ignore storage quota errors
  }
}

function loadActiveThemeIdFromStorage(): string {
  if (typeof window === 'undefined') return 'default'
  try {
    return window.localStorage.getItem(STORAGE_ACTIVE_THEME) || 'default'
  } catch {
    return 'default'
  }
}

function saveActiveThemeIdToStorage(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_ACTIVE_THEME, id)
  } catch {
    // Ignore storage quota errors
  }
}

export interface ThemeState {
  activeThemeId: string
  customThemes: MotrixTheme[]
  contrastWarnings: ContrastValidationResult[]
  selectTheme: (id: string) => void
  importTheme: (content: string, fileName?: string) => MotrixTheme
  deleteCustomTheme: (id: string) => void
  exportTheme: (
    id: string,
    format?: 'json' | 'base16'
  ) => { filename: string; content: string }
  getActiveTheme: () => MotrixTheme | null
  getAllThemes: () => { presets: MotrixTheme[]; custom: MotrixTheme[] }
}

const initialCustomThemes = loadCustomThemesFromStorage()
const initialActiveId = loadActiveThemeIdFromStorage()

function resolveTheme(
  id: string,
  customList: MotrixTheme[]
): MotrixTheme | null {
  if (id === 'default') return null
  const preset = PRESET_THEMES.find((t) => t.id === id)
  if (preset) return preset
  const custom = customList.find((t) => t.id === id)
  return custom ?? null
}

// Initial bootstrap application
if (typeof document !== 'undefined') {
  const initialTheme = resolveTheme(initialActiveId, initialCustomThemes)
  applyCustomThemeCss(initialTheme)
}

export const useThemeManager = create<ThemeState>((set, get) => ({
  activeThemeId: initialActiveId,
  customThemes: initialCustomThemes,
  contrastWarnings: [],

  getActiveTheme: () => {
    const { activeThemeId, customThemes } = get()
    return resolveTheme(activeThemeId, customThemes)
  },

  getAllThemes: () => ({
    presets: PRESET_THEMES,
    custom: get().customThemes,
  }),

  selectTheme: (id: string) => {
    const { customThemes } = get()
    const targetTheme = resolveTheme(id, customThemes)
    const activeId = targetTheme ? id : 'default'

    saveActiveThemeIdToStorage(activeId)
    applyCustomThemeCss(targetTheme)

    let contrastWarnings: ContrastValidationResult[] = []
    if (targetTheme) {
      contrastWarnings = validateThemeContrast(targetTheme.colors).filter(
        (c) => !c.valid
      )
    }

    set({ activeThemeId: activeId, contrastWarnings })
  },

  importTheme: (content: string, fileName?: string) => {
    const { theme } = parseThemeFileContent(content, fileName)
    const { customThemes } = get()

    // Replace if same ID exists, otherwise prepend
    const existingIndex = customThemes.findIndex((t) => t.id === theme.id)
    let updatedThemes: MotrixTheme[]
    if (existingIndex >= 0) {
      updatedThemes = [...customThemes]
      updatedThemes[existingIndex] = theme
    } else {
      updatedThemes = [theme, ...customThemes]
    }

    saveCustomThemesToStorage(updatedThemes)
    saveActiveThemeIdToStorage(theme.id)
    applyCustomThemeCss(theme)

    const contrastWarnings = validateThemeContrast(theme.colors).filter(
      (c) => !c.valid
    )

    set({
      customThemes: updatedThemes,
      activeThemeId: theme.id,
      contrastWarnings,
    })

    return theme
  },

  deleteCustomTheme: (id: string) => {
    const { customThemes, activeThemeId } = get()
    const updatedThemes = customThemes.filter((t) => t.id !== id)
    saveCustomThemesToStorage(updatedThemes)

    let nextActiveId = activeThemeId
    if (activeThemeId === id) {
      nextActiveId = 'default'
      saveActiveThemeIdToStorage(nextActiveId)
      applyCustomThemeCss(null)
    }

    set({
      customThemes: updatedThemes,
      activeThemeId: nextActiveId,
      contrastWarnings: [],
    })
  },

  exportTheme: (id: string, format: 'json' | 'base16' = 'json') => {
    const { customThemes } = get()
    const theme = resolveTheme(id, customThemes)
    if (!theme) {
      throw new Error(`Theme "${id}" not found`)
    }
    const result = exportThemeToFile(theme, format)
    if (typeof document !== 'undefined') {
      const blob = new Blob([result.content], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
    return { filename: result.filename, content: result.content }
  },
}))
