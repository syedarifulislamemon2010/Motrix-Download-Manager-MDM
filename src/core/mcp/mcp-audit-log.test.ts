import type { McpSettings } from '@shared/schemas/mcp-settings'
import { describe, expect, it, vi } from 'vitest'
import { McpAuditLog } from './mcp-audit-log'

describe('McpAuditLog', () => {
  const defaultSettings: McpSettings = {
    enabled: true,
    permissionTier: 'standard',
    allowDeleteFiles: false,
    maxLogEntries: 3,
  }

  it('records audit log entries and bounds the history', () => {
    const emit = vi.fn()
    const log = new McpAuditLog({
      getSettings: () => defaultSettings,
      eventBus: { emit },
    })

    log.record({
      tool: 'motrix_list_tasks',
      tier: 'read_only',
      allowed: true,
      status: 'success',
      summary: 'Listed 2 tasks',
    })

    log.record({
      tool: 'motrix_add_task',
      params: { uri: 'https://example.com/file.zip' },
      tier: 'standard',
      allowed: true,
      status: 'success',
      summary: 'Added task task-1',
    })

    const e3 = log.record({
      tool: 'motrix_remove_task',
      tier: 'full',
      allowed: false,
      status: 'denied',
      error: 'Permission denied',
    })

    expect(log.getEntries()).toHaveLength(3)
    expect(log.getEntries()[0].id).toBe(e3.id) // Newest first
    expect(emit).toHaveBeenCalledTimes(3)

    // Exceeding maxEntries (set to 10 minimum in code):
    // Let's test with settings maxLogEntries = 10
    for (let i = 0; i < 15; i++) {
      log.record({
        tool: `tool_${i}`,
        tier: 'read_only',
        allowed: true,
        status: 'success',
      })
    }
    expect(log.getEntries().length).toBe(10)
  })

  it('redacts sensitive parameter values', () => {
    const log = new McpAuditLog({
      getSettings: () => defaultSettings,
    })

    const entry = log.record({
      tool: 'motrix_add_task',
      params: {
        password: 'super-secret-password',
        token: 'secret-token-12345',
        uri: 'https://example.com/test.zip',
      },
      tier: 'standard',
      allowed: true,
      status: 'success',
    })

    expect(entry.params?.password).not.toBe('super-secret-password')
    expect(entry.params?.token).not.toBe('secret-token-12345')
  })

  it('clears all entries', () => {
    const log = new McpAuditLog({
      getSettings: () => defaultSettings,
    })

    log.record({
      tool: 'test',
      tier: 'read_only',
      allowed: true,
      status: 'success',
    })
    expect(log.getEntries()).toHaveLength(1)

    log.clear()
    expect(log.getEntries()).toHaveLength(0)
  })
})
