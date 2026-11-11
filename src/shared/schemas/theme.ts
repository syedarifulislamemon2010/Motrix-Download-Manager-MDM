import { z } from 'zod'

export const colorStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (val) => {
      // Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA or without #
      if (/^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(val)) {
        return true
      }
      // CSS functional colors: rgb(), rgba(), hsl(), hsla(), oklch()
      if (/^(rgb|rgba|hsl|hsla|oklch)\(.*\)$/i.test(val)) {
        return true
      }
      return false
    },
    { message: 'Invalid color format. Expected hex, rgb, hsl, or oklch color.' }
  )

export const motrixThemeColorsSchema = z
  .object({
    background: colorStringSchema,
    foreground: colorStringSchema,
    card: colorStringSchema,
    cardForeground: colorStringSchema,
    popover: colorStringSchema,
    popoverForeground: colorStringSchema,
    primary: colorStringSchema,
    primaryForeground: colorStringSchema,
    secondary: colorStringSchema,
    secondaryForeground: colorStringSchema,
    muted: colorStringSchema,
    mutedForeground: colorStringSchema,
    accent: colorStringSchema,
    accentForeground: colorStringSchema,
    destructive: colorStringSchema,
    border: colorStringSchema,
    input: colorStringSchema,
    ring: colorStringSchema,
    sidebar: colorStringSchema,
    sidebarForeground: colorStringSchema,
    sidebarPrimary: colorStringSchema.optional(),
    sidebarPrimaryForeground: colorStringSchema.optional(),
    sidebarBorder: colorStringSchema.optional(),
  })
  .strict()

export type MotrixThemeColors = z.infer<typeof motrixThemeColorsSchema>

export const motrixThemeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    author: z.string().optional(),
    description: z.string().optional(),
    variant: z.enum(['light', 'dark']),
    colors: motrixThemeColorsSchema,
  })
  .strict()

export type MotrixTheme = z.infer<typeof motrixThemeSchema>

export const base16SchemeSchema = z
  .object({
    scheme: z.string().min(1),
    author: z.string().optional(),
    variant: z.enum(['light', 'dark']).optional(),
    base00: z.string(),
    base01: z.string(),
    base02: z.string(),
    base03: z.string(),
    base04: z.string(),
    base05: z.string(),
    base06: z.string(),
    base07: z.string(),
    base08: z.string(),
    base09: z.string(),
    base0A: z.string(),
    base0B: z.string(),
    base0C: z.string(),
    base0D: z.string(),
    base0E: z.string(),
    base0F: z.string(),
  })
  .passthrough()

export type Base16Scheme = z.infer<typeof base16SchemeSchema>

function normalizeHex(hex: string): string {
  const clean = hex.trim().replace(/^#/, '')
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
  }
  if (clean.length === 6) {
    return `#${clean}`
  }
  return `#${clean.slice(0, 6)}`
}

export function parseHexToRgb(color: string): [number, number, number] | null {
  const match = color.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i)
  if (!match) return null
  const hex = match[1]
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ]
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const v = val / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function calculateContrastRatio(colorA: string, colorB: string): number {
  const rgbA = parseHexToRgb(colorA)
  const rgbB = parseHexToRgb(colorB)
  if (!rgbA || !rgbB) return 21 // Fallback when non-hex (e.g. oklch) cannot be directly parsed in pure regex
  const lumA = getRelativeLuminance(...rgbA)
  const lumB = getRelativeLuminance(...rgbB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastValidationResult {
  valid: boolean
  ratio: number
  target: string
  warning?: string
}

export function validateThemeContrast(
  colors: MotrixThemeColors
): ContrastValidationResult[] {
  const checks = [
    {
      name: 'background / foreground',
      a: colors.background,
      b: colors.foreground,
      min: 4.5,
    },
    {
      name: 'card / cardForeground',
      a: colors.card,
      b: colors.cardForeground,
      min: 4.5,
    },
    {
      name: 'primary / primaryForeground',
      a: colors.primary,
      b: colors.primaryForeground,
      min: 3.0,
    },
    {
      name: 'sidebar / sidebarForeground',
      a: colors.sidebar,
      b: colors.sidebarForeground,
      min: 4.5,
    },
  ]

  return checks.map((c) => {
    const ratio = calculateContrastRatio(c.a, c.b)
    const valid = ratio >= c.min
    return {
      valid,
      ratio: Math.round(ratio * 100) / 100,
      target: c.name,
      warning: valid
        ? undefined
        : `Low contrast ratio (${Math.round(ratio * 10) / 10}:1, recommended >= ${c.min}:1)`,
    }
  })
}

export function parseBase16ToMotrixTheme(base16: Base16Scheme): MotrixTheme {
  const b00 = normalizeHex(base16.base00)
  const b01 = normalizeHex(base16.base01)
  const b02 = normalizeHex(base16.base02)
  const b03 = normalizeHex(base16.base03)
  const b04 = normalizeHex(base16.base04)
  const b05 = normalizeHex(base16.base05)
  const b06 = normalizeHex(base16.base06)
  const b07 = normalizeHex(base16.base07)
  const b08 = normalizeHex(base16.base08)
  const b0D = normalizeHex(base16.base0D)

  let variant = base16.variant
  if (!variant) {
    const rgb00 = parseHexToRgb(b00)
    if (rgb00) {
      const lum = getRelativeLuminance(...rgb00)
      variant = lum > 0.5 ? 'light' : 'dark'
    } else {
      variant = 'dark'
    }
  }

  const isLight = variant === 'light'

  const id = `base16-${base16.scheme.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`

  return {
    id,
    name: base16.scheme,
    author: base16.author,
    variant,
    colors: isLight
      ? {
          background: b00,
          foreground: b05,
          card: b01,
          cardForeground: b05,
          popover: b01,
          popoverForeground: b05,
          primary: b0D,
          primaryForeground: b07,
          secondary: b02,
          secondaryForeground: b05,
          muted: b01,
          mutedForeground: b03,
          accent: b02,
          accentForeground: b05,
          destructive: b08,
          border: b02,
          input: b02,
          ring: b0D,
          sidebar: b01,
          sidebarForeground: b05,
          sidebarPrimary: b0D,
          sidebarPrimaryForeground: b07,
          sidebarBorder: b02,
        }
      : {
          background: b00,
          foreground: b05,
          card: b01,
          cardForeground: b05,
          popover: b01,
          popoverForeground: b05,
          primary: b0D,
          primaryForeground: b00,
          secondary: b02,
          secondaryForeground: b05,
          muted: b02,
          mutedForeground: b04,
          accent: b02,
          accentForeground: b06,
          destructive: b08,
          border: b02,
          input: b02,
          ring: b0D,
          sidebar: b00,
          sidebarForeground: b05,
          sidebarPrimary: b0D,
          sidebarPrimaryForeground: b00,
          sidebarBorder: b02,
        },
  }
}

export function motrixThemeToBase16(theme: MotrixTheme): Base16Scheme {
  const getHexOnly = (color: string) => {
    const rgb = parseHexToRgb(color)
    if (!rgb) return '808080'
    return rgb.map((x) => x.toString(16).padStart(2, '0')).join('')
  }

  return {
    scheme: theme.name,
    author: theme.author || 'Motrix User',
    variant: theme.variant,
    base00: getHexOnly(theme.colors.background),
    base01: getHexOnly(theme.colors.card),
    base02: getHexOnly(theme.colors.border),
    base03: getHexOnly(theme.colors.mutedForeground),
    base04: getHexOnly(theme.colors.mutedForeground),
    base05: getHexOnly(theme.colors.foreground),
    base06: getHexOnly(theme.colors.accentForeground),
    base07: getHexOnly(theme.colors.primaryForeground),
    base08: getHexOnly(theme.colors.destructive),
    base09: 'd08770',
    base0A: 'ebcb8b',
    base0B: 'a3be8c',
    base0C: '88c0d0',
    base0D: getHexOnly(theme.colors.primary),
    base0E: 'b48ead',
    base0F: 'ab7967',
  }
}
