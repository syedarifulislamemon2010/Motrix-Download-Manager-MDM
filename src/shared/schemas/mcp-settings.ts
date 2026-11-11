import { z } from 'zod'
import { settingsInputObject } from './settings-input'

export const mcpPermissionTierSchema = z.enum(['read_only', 'standard', 'full'])
export type McpPermissionTier = z.infer<typeof mcpPermissionTierSchema>

export const mcpAuditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  tool: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  tier: mcpPermissionTierSchema,
  allowed: z.boolean(),
  status: z.enum(['success', 'denied', 'error']),
  summary: z.string().optional(),
  error: z.string().optional(),
})
export type McpAuditEntry = z.infer<typeof mcpAuditEntrySchema>

export const mcpSettingsSchema = z.object({
  enabled: z.boolean().catch(false),
  permissionTier: mcpPermissionTierSchema.catch('standard'),
  allowDeleteFiles: z.boolean().catch(false),
  maxLogEntries: z.number().int().min(10).max(1000).catch(100),
})
export type McpSettings = z.infer<typeof mcpSettingsSchema>

export const DEFAULT_MCP_SETTINGS: McpSettings = {
  enabled: false,
  permissionTier: 'standard',
  allowDeleteFiles: false,
  maxLogEntries: 100,
}

export const mcpSettingsInputSchema = settingsInputObject(mcpSettingsSchema)
