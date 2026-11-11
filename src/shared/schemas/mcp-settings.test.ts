import { describe, expect, it } from 'vitest'
import { mcpAuditEntrySchema, mcpSettingsSchema } from './mcp-settings'

describe('mcpSettingsSchema', () => {
  it('parses valid mcp settings', () => {
    const input = {
      enabled: true,
      permissionTier: 'full',
      allowDeleteFiles: true,
      maxLogEntries: 200,
    }
    const result = mcpSettingsSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('falls back to safe defaults when fields are missing or invalid', () => {
    const result = mcpSettingsSchema.parse({
      permissionTier: 'invalid_tier',
      maxLogEntries: 99999,
    })
    expect(result.enabled).toBe(false)
    expect(result.permissionTier).toBe('standard')
    expect(result.allowDeleteFiles).toBe(false)
    expect(result.maxLogEntries).toBe(100)
  })

  it('validates mcpAuditEntrySchema', () => {
    const entry = {
      id: 'entry-1',
      timestamp: Date.now(),
      tool: 'add_task',
      params: { uri: 'https://example.com/file.zip' },
      tier: 'standard',
      allowed: true,
      status: 'success',
      summary: 'Task created with ID task-123',
    }
    const result = mcpAuditEntrySchema.parse(entry)
    expect(result.id).toBe('entry-1')
    expect(result.allowed).toBe(true)
    expect(result.status).toBe('success')
  })
})
