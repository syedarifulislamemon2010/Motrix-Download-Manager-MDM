import type { McpSettings } from '@shared/schemas/mcp-settings'
import { describe, expect, it } from 'vitest'
import { McpPermissionGuard } from './mcp-permission-guard'

describe('McpPermissionGuard', () => {
  it('rejects all tools when MCP is disabled', () => {
    const settings: McpSettings = {
      enabled: false,
      permissionTier: 'full',
      allowDeleteFiles: true,
      maxLogEntries: 100,
    }
    const guard = new McpPermissionGuard(() => settings)

    const res = guard.checkToolPermission('read_only', 'motrix_list_tasks')
    expect(res.allowed).toBe(false)
    expect(res.reason).toContain('disabled')
  })

  it('allows read_only tools on read_only tier but rejects higher tiers', () => {
    const settings: McpSettings = {
      enabled: true,
      permissionTier: 'read_only',
      allowDeleteFiles: false,
      maxLogEntries: 100,
    }
    const guard = new McpPermissionGuard(() => settings)

    expect(
      guard.checkToolPermission('read_only', 'motrix_list_tasks').allowed
    ).toBe(true)

    const standardCheck = guard.checkToolPermission(
      'standard',
      'motrix_add_task'
    )
    expect(standardCheck.allowed).toBe(false)
    expect(standardCheck.reason).toContain(
      "requires 'standard' permission tier"
    )

    const fullCheck = guard.checkToolPermission('full', 'motrix_remove_task')
    expect(fullCheck.allowed).toBe(false)
  })

  it('allows standard and read_only tools on standard tier, rejects full', () => {
    const settings: McpSettings = {
      enabled: true,
      permissionTier: 'standard',
      allowDeleteFiles: false,
      maxLogEntries: 100,
    }
    const guard = new McpPermissionGuard(() => settings)

    expect(
      guard.checkToolPermission('read_only', 'motrix_list_tasks').allowed
    ).toBe(true)
    expect(
      guard.checkToolPermission('standard', 'motrix_add_task').allowed
    ).toBe(true)
    expect(
      guard.checkToolPermission('full', 'motrix_remove_task').allowed
    ).toBe(false)
  })

  it('allows full tier tools, but gates deleteFiles on allowDeleteFiles', () => {
    let allowDelete = false
    const settings: McpSettings = {
      enabled: true,
      permissionTier: 'full',
      get allowDeleteFiles() {
        return allowDelete
      },
      maxLogEntries: 100,
    }
    const guard = new McpPermissionGuard(() => settings)

    // Ordinary remove task without deleteFiles is allowed
    expect(
      guard.checkToolPermission('full', 'motrix_remove_task', {
        deleteFiles: false,
      }).allowed
    ).toBe(true)

    // deleteFiles=true when allowDeleteFiles=false is rejected
    const delCheck = guard.checkToolPermission('full', 'motrix_remove_task', {
      deleteFiles: true,
    })
    expect(delCheck.allowed).toBe(false)
    expect(delCheck.reason).toContain('allowDeleteFiles')

    // When allowDeleteFiles=true, it is allowed
    allowDelete = true
    expect(
      guard.checkToolPermission('full', 'motrix_remove_task', {
        deleteFiles: true,
      }).allowed
    ).toBe(true)
  })
})
