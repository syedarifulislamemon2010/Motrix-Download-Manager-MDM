import { z } from 'zod'
import { settingsInputObject } from './settings-input'

export const helperToolsSettingsSchema = z.object({
  ytDlpBinaryPath: z.string().catch(''),
  galleryDlBinaryPath: z.string().catch(''),
  denoBinaryPath: z.string().catch(''),
})

export type HelperToolsSettings = z.infer<typeof helperToolsSettingsSchema>

export const DEFAULT_HELPER_TOOLS_SETTINGS: HelperToolsSettings = {
  ytDlpBinaryPath: '',
  galleryDlBinaryPath: '',
  denoBinaryPath: '',
}

export const helperToolsSettingsInputSchema = settingsInputObject(
  helperToolsSettingsSchema
).extend({
  ytDlpBinaryPath: helperToolsSettingsSchema.shape.ytDlpBinaryPath
    .removeCatch()
    .refine((value) => !value.includes('\0')),
  galleryDlBinaryPath: helperToolsSettingsSchema.shape.galleryDlBinaryPath
    .removeCatch()
    .refine((value) => !value.includes('\0')),
  denoBinaryPath: helperToolsSettingsSchema.shape.denoBinaryPath
    .removeCatch()
    .refine((value) => !value.includes('\0')),
})
