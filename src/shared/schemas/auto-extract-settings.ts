import { z } from 'zod'
import { settingsInputObject } from './settings-input'

export const autoExtractModeSchema = z.enum(['off', 'in_place', 'subfolder'])
export type AutoExtractMode = z.infer<typeof autoExtractModeSchema>

export const archiveFormatsSchema = z.object({
  zip: z.boolean().catch(true),
  sevenZip: z.boolean().catch(true),
  rar: z.boolean().catch(true),
})
export type ArchiveFormats = z.infer<typeof archiveFormatsSchema>

export const autoExtractSettingsSchema = z.object({
  enabled: z.boolean().catch(false),
  mode: autoExtractModeSchema.catch('subfolder'),
  deleteArchiveAfterExtract: z.boolean().catch(false),
  formats: archiveFormatsSchema.catch({
    zip: true,
    sevenZip: true,
    rar: true,
  }),
  custom7zPath: z.string().catch(''),
  passwordList: z.array(z.string()).catch([]),
})
export type AutoExtractSettings = z.infer<typeof autoExtractSettingsSchema>

export const DEFAULT_AUTO_EXTRACT_SETTINGS: AutoExtractSettings = {
  enabled: false,
  mode: 'subfolder',
  deleteArchiveAfterExtract: false,
  formats: {
    zip: true,
    sevenZip: true,
    rar: true,
  },
  custom7zPath: '',
  passwordList: [],
}

export const autoExtractSettingsInputSchema = settingsInputObject(
  autoExtractSettingsSchema
).extend({
  formats: settingsInputObject(archiveFormatsSchema),
})
