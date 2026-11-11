import {
  base16SchemeSchema,
  type MotrixTheme,
  motrixThemeSchema,
  motrixThemeToBase16,
  parseBase16ToMotrixTheme,
} from '@shared/schemas/theme'
import { load as parseYaml } from 'js-yaml'

export interface ParsedThemeResult {
  theme: MotrixTheme
  sourceFormat: 'motrix-json' | 'base16-json' | 'base16-yaml'
}

export function parseThemeFileContent(
  content: string,
  fileName?: string
): ParsedThemeResult {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Theme file is empty')
  }

  // 1. Try parsing as JSON first
  let rawJson: unknown
  let isJson = false
  try {
    rawJson = JSON.parse(trimmed)
    isJson = true
  } catch {
    // Not valid JSON, will try YAML next
  }

  if (isJson && rawJson && typeof rawJson === 'object') {
    // 1a. Direct Motrix Theme JSON
    const motrixCheck = motrixThemeSchema.safeParse(rawJson)
    if (motrixCheck.success) {
      return {
        theme: motrixCheck.data,
        sourceFormat: 'motrix-json',
      }
    }

    // 1b. Base16 JSON
    const base16Check = base16SchemeSchema.safeParse(rawJson)
    if (base16Check.success) {
      return {
        theme: parseBase16ToMotrixTheme(base16Check.data),
        sourceFormat: 'base16-json',
      }
    }
  }

  // 2. Try parsing as YAML (standard for Base16 schemes)
  try {
    const rawYaml = parseYaml(trimmed)
    if (rawYaml && typeof rawYaml === 'object') {
      const base16Check = base16SchemeSchema.safeParse(rawYaml)
      if (base16Check.success) {
        return {
          theme: parseBase16ToMotrixTheme(base16Check.data),
          sourceFormat: 'base16-yaml',
        }
      }

      const motrixCheck = motrixThemeSchema.safeParse(rawYaml)
      if (motrixCheck.success) {
        return {
          theme: motrixCheck.data,
          sourceFormat: 'motrix-json',
        }
      }
    }
  } catch {
    // YAML parsing failed as well
  }

  const nameHint = fileName ? ` for file "${fileName}"` : ''
  throw new Error(
    `Invalid theme format${nameHint}. Please provide a valid Motrix Theme JSON or Base16 YAML/JSON file.`
  )
}

export function exportThemeToFile(
  theme: MotrixTheme,
  format: 'json' | 'base16' = 'json'
): { content: string; filename: string; mimeType: string } {
  if (format === 'base16') {
    const base16 = motrixThemeToBase16(theme)
    return {
      content: JSON.stringify(base16, null, 2),
      filename: `${theme.id}.base16.json`,
      mimeType: 'application/json',
    }
  }

  return {
    content: JSON.stringify(theme, null, 2),
    filename: `${theme.id}.motrix-theme.json`,
    mimeType: 'application/json',
  }
}
