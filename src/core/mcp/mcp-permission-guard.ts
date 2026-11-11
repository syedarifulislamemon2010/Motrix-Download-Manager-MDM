import type {
  McpPermissionTier,
  McpSettings,
} from '@shared/schemas/mcp-settings'

const TIER_LEVELS: Record<McpPermissionTier, number> = {
  read_only: 1,
  standard: 2,
  full: 3,
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export class McpPermissionGuard {
  constructor(private readonly getSettings: () => McpSettings) {}

  checkToolPermission(
    requiredTier: McpPermissionTier,
    toolName: string,
    params?: Record<string, unknown>
  ): PermissionCheckResult {
    const settings = this.getSettings()

    if (!settings.enabled) {
      return {
        allowed: false,
        reason: 'AI Assistant MCP is disabled in Motrix settings',
      }
    }

    const currentLevel = TIER_LEVELS[settings.permissionTier] ?? 1
    const requiredLevel = TIER_LEVELS[requiredTier] ?? 3

    if (currentLevel < requiredLevel) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' requires '${requiredTier}' permission tier, but current tier is '${settings.permissionTier}'`,
      }
    }

    // Special safety rule for file deletion
    if (toolName === 'motrix_remove_task' && params?.deleteFiles === true) {
      if (!settings.allowDeleteFiles) {
        return {
          allowed: false,
          reason:
            "Removing files from disk is prohibited by Motrix settings ('allowDeleteFiles' is disabled)",
        }
      }
    }

    return { allowed: true }
  }
}
