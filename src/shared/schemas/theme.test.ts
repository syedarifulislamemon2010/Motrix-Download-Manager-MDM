import { describe, expect, it } from 'vitest'
import {
  type Base16Scheme,
  calculateContrastRatio,
  colorStringSchema,
  type MotrixTheme,
  motrixThemeSchema,
  motrixThemeToBase16,
  parseBase16ToMotrixTheme,
  validateThemeContrast,
} from './theme'

describe('Theme Schemas & Utilities', () => {
  it('validates supported color strings', () => {
    expect(colorStringSchema.safeParse('#ffffff').success).toBe(true)
    expect(colorStringSchema.safeParse('#fff').success).toBe(true)
    expect(colorStringSchema.safeParse('282c34').success).toBe(true)
    expect(colorStringSchema.safeParse('rgb(255, 255, 255)').success).toBe(true)
    expect(colorStringSchema.safeParse('rgba(0, 0, 0, 0.5)').success).toBe(true)
    expect(colorStringSchema.safeParse('hsl(210, 50%, 50%)').success).toBe(true)
    expect(colorStringSchema.safeParse('oklch(0.2 0.05 240)').success).toBe(
      true
    )
    expect(colorStringSchema.safeParse('not-a-color-at-all').success).toBe(
      false
    )
  })

  it('validates a complete MotrixTheme', () => {
    const sampleTheme: MotrixTheme = {
      id: 'nord-dark',
      name: 'Nord Dark',
      author: 'Arctic Ice Studio',
      variant: 'dark',
      colors: {
        background: '#2e3440',
        foreground: '#eceff4',
        card: '#3b4252',
        cardForeground: '#eceff4',
        popover: '#3b4252',
        popoverForeground: '#eceff4',
        primary: '#88c0d0',
        primaryForeground: '#2e3440',
        secondary: '#434c5e',
        secondaryForeground: '#eceff4',
        muted: '#434c5e',
        mutedForeground: '#d8dee9',
        accent: '#4c566a',
        accentForeground: '#eceff4',
        destructive: '#bf616a',
        border: '#434c5e',
        input: '#434c5e',
        ring: '#88c0d0',
        sidebar: '#2e3440',
        sidebarForeground: '#eceff4',
      },
    }

    const parsed = motrixThemeSchema.parse(sampleTheme)
    expect(parsed.id).toBe('nord-dark')
    expect(parsed.variant).toBe('dark')
    expect(parsed.colors.primary).toBe('#88c0d0')
  })

  it('calculates WCAG contrast ratio correctly', () => {
    // Pure black (#000000) vs pure white (#ffffff) ratio is 21:1
    const maxRatio = calculateContrastRatio('#000000', '#ffffff')
    expect(Math.round(maxRatio)).toBe(21)

    // Same color ratio is 1:1
    const minRatio = calculateContrastRatio('#ffffff', '#ffffff')
    expect(Math.round(minRatio)).toBe(1)

    // Standard dark mode background (#121212) vs text (#ffffff)
    const darkRatio = calculateContrastRatio('#121212', '#ffffff')
    expect(darkRatio).toBeGreaterThan(15)
  })

  it('validates theme contrast and detects low contrast', () => {
    const goodColors = {
      background: '#000000',
      foreground: '#ffffff',
      card: '#111111',
      cardForeground: '#ffffff',
      popover: '#111111',
      popoverForeground: '#ffffff',
      primary: '#0066cc',
      primaryForeground: '#ffffff',
      secondary: '#222222',
      secondaryForeground: '#ffffff',
      muted: '#222222',
      mutedForeground: '#cccccc',
      accent: '#222222',
      accentForeground: '#ffffff',
      destructive: '#ff0000',
      border: '#333333',
      input: '#333333',
      ring: '#0066cc',
      sidebar: '#050505',
      sidebarForeground: '#ffffff',
    }

    const results = validateThemeContrast(goodColors)
    expect(results.every((r) => r.valid)).toBe(true)

    // Bad contrast (grey on grey)
    const badColors = {
      ...goodColors,
      foreground: '#151515',
    }
    const badResults = validateThemeContrast(badColors)
    const bgFgCheck = badResults.find(
      (r) => r.target === 'background / foreground'
    )
    expect(bgFgCheck?.valid).toBe(false)
    expect(bgFgCheck?.warning).toContain('Low contrast ratio')
  })

  it('converts Base16 scheme to MotrixTheme and back', () => {
    const base16: Base16Scheme = {
      scheme: 'OneDark',
      author: 'Lalit Magant',
      variant: 'dark',
      base00: '282c34',
      base01: '353b45',
      base02: '3e4451',
      base03: '545862',
      base04: '565c64',
      base05: 'abb2bf',
      base06: 'b6bdca',
      base07: 'c8ccd4',
      base08: 'e06c75',
      base09: 'd19a66',
      base0A: 'e5c07b',
      base0B: '98c379',
      base0C: '56b6c2',
      base0D: '61afef',
      base0E: 'c678dd',
      base0F: 'be5046',
    }

    const theme = parseBase16ToMotrixTheme(base16)
    expect(theme.name).toBe('OneDark')
    expect(theme.variant).toBe('dark')
    expect(theme.colors.background).toBe('#282c34')
    expect(theme.colors.card).toBe('#353b45')
    expect(theme.colors.primary).toBe('#61afef')

    const convertedBack = motrixThemeToBase16(theme)
    expect(convertedBack.scheme).toBe('OneDark')
    expect(convertedBack.base00.toLowerCase()).toBe('282c34')
    expect(convertedBack.base0D.toLowerCase()).toBe('61afef')
  })

  it('auto-detects light variant in Base16 scheme without explicit variant', () => {
    const lightBase16: Base16Scheme = {
      scheme: 'PaperColor Light',
      base00: 'eeeeee', // Light background
      base01: 'af0000',
      base02: '008700',
      base03: '5f8700',
      base04: '0087af',
      base05: '444444', // Dark foreground
      base06: '005f87',
      base07: '878787',
      base08: 'bcbcbc',
      base09: 'd70000',
      base0A: 'd70087',
      base0B: '005faf',
      base0C: 'd75f00',
      base0D: '005f87',
      base0E: '008787',
      base0F: '00875f',
    }

    const theme = parseBase16ToMotrixTheme(lightBase16)
    expect(theme.variant).toBe('light')
  })
})
