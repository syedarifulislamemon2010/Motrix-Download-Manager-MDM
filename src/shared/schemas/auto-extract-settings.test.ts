import { describe, expect, it } from 'vitest'
import {
  autoExtractSettingsInputSchema,
  autoExtractSettingsSchema,
  DEFAULT_AUTO_EXTRACT_SETTINGS,
} from './auto-extract-settings'

describe('autoExtractSettingsSchema', () => {
  it('parses valid auto extract settings', () => {
    const input = {
      enabled: true,
      mode: 'in_place' as const,
      deleteArchiveAfterExtract: true,
      formats: {
        zip: true,
        sevenZip: false,
        rar: true,
      },
      custom7zPath: 'C:\\Tools\\7z.exe',
      passwordList: ['secret123'],
    }
    const parsed = autoExtractSettingsSchema.parse(input)
    expect(parsed).toEqual(input)
  })

  it('falls back to defaults on corrupt inputs', () => {
    const corrupt = {
      enabled: 'yes',
      mode: 'invalid_mode',
      deleteArchiveAfterExtract: 123,
      formats: 'all',
      passwordList: 'not_an_array',
    }
    const parsed = autoExtractSettingsSchema.parse(corrupt)
    expect(parsed).toEqual(DEFAULT_AUTO_EXTRACT_SETTINGS)
  })

  it('input schema rejects invalid mode strictly', () => {
    const invalid = {
      enabled: true,
      mode: 'nonexistent',
      deleteArchiveAfterExtract: false,
      formats: { zip: true, sevenZip: true, rar: true },
      custom7zPath: '',
      passwordList: [],
    }
    const result = autoExtractSettingsInputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
