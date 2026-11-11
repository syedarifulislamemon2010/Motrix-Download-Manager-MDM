import { appSettingsSchema } from '@shared/schemas/app-settings'
import { autoExtractSettingsSchema } from '@shared/schemas/auto-extract-settings'
import { helperToolsSettingsSchema } from '@shared/schemas/helper-tools-settings'
import { dashboardLayoutSettingsSchema } from '@shared/schemas/dashboard-layout'
import { engineSettingsSchema } from '@shared/schemas/engine-settings'
import { mcpSettingsSchema } from '@shared/schemas/mcp-settings'
import { natSettingsSchema } from '@shared/schemas/nat-settings'
import { networkSettingsSchema } from '@shared/schemas/network-settings'
import { speedLimitSettingsSchema } from '@shared/schemas/speed-limit'
import type {
  DashboardLayoutSettings,
  EngineSettings,
  MotrixAppSettings,
  NatSettings,
  SpeedLimitSettings,
} from '@shared/types/settings'

// ─── Zod Schemas ──────────────────────────────────────────────
// Each field uses .catch() to provide a default when validation
// fails. This means invalid input silently falls back to a safe
// default rather than throwing — appropriate for settings that
// may come from user-edited JSON files.
//
// Error codes follow the pattern `settings.{namespace}.{field}`
// for future i18n integration. The renderer layer can map these
// to translated messages via a locale file.

export {
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
} from '@shared/schemas/app-settings'
export {
  type AutoExtractSettings,
  autoExtractSettingsSchema,
  DEFAULT_AUTO_EXTRACT_SETTINGS,
} from '@shared/schemas/auto-extract-settings'
export {
  type HelperToolsSettings,
  helperToolsSettingsSchema,
  DEFAULT_HELPER_TOOLS_SETTINGS,
} from '@shared/schemas/helper-tools-settings'
export {
  DASHBOARD_COLUMNS,
  DEFAULT_DASHBOARD_LAYOUT,
  dashboardLayoutSettingsSchema,
} from '@shared/schemas/dashboard-layout'
export {
  DEFAULT_ENGINE_SETTINGS,
  engineSettingsSchema,
} from '@shared/schemas/engine-settings'
export {
  DEFAULT_GEOIP_SETTINGS,
  geoIpSettingsSchema,
} from '@shared/schemas/geoip-settings'
export {
  DEFAULT_MCP_SETTINGS,
  type McpSettings,
  mcpSettingsSchema,
} from '@shared/schemas/mcp-settings'
export {
  DEFAULT_MEDIA_SETTINGS,
  mediaSettingsSchema,
} from '@shared/schemas/media-settings'
export {
  DEFAULT_NAT_SETTINGS,
  natSettingsSchema,
} from '@shared/schemas/nat-settings'
export {
  DEFAULT_NETWORK_SETTINGS,
  networkSettingsSchema,
} from '@shared/schemas/network-settings'
export {
  DEFAULT_ONBOARDING_STATE,
  onboardingStateSchema,
} from '@shared/schemas/onboarding-state'

// ─── Speed Limit Settings ─────────────────────────────────────
// Schema lives in @shared/schemas so the renderer form and core
// IPC validation share a single definition.
export {
  DEFAULT_SPEED_LIMIT_SETTINGS,
  speedLimitSettingsSchema,
} from '@shared/schemas/speed-limit'

// ─── Tracker Settings ─────────────────────────────────────────
// Schema lives in @shared/schemas so the renderer RHF resolver
// and core IPC validation share a single definition.
export {
  DEFAULT_TRACKER_SETTINGS,
  trackerSettingsSchema,
  validateTrackerSettings,
} from '@shared/schemas/tracker-settings'
export {
  windowBoundsSchema,
  windowStateSchema,
} from '@shared/schemas/window-bounds'

// ─── Validation functions ─────────────────────────────────────
// These maintain the same public API as before the Zod refactor.
// .parse() with .catch() on every field means any invalid value
// silently falls back to its default — no exceptions thrown.

export function validateEngineSettings(input: EngineSettings): EngineSettings {
  return engineSettingsSchema.parse(input)
}

export function validateAppSettings(
  input: MotrixAppSettings
): MotrixAppSettings {
  return appSettingsSchema.parse(input)
}

export function validateNatSettings(input: NatSettings): NatSettings {
  return natSettingsSchema.parse(input)
}

export function validateNetworkSettings(
  input: import('@shared/schemas/network-settings').NetworkSettings
): import('@shared/schemas/network-settings').NetworkSettings {
  return networkSettingsSchema.parse(input)
}

export function validateMcpSettings(
  input: import('@shared/schemas/mcp-settings').McpSettings
): import('@shared/schemas/mcp-settings').McpSettings {
  return mcpSettingsSchema.parse(input)
}

export function validateAutoExtractSettings(
  input: unknown
): import('@shared/schemas/auto-extract-settings').AutoExtractSettings {
  return autoExtractSettingsSchema.parse(input)
}

export function validateHelperToolsSettings(
  input: unknown
): import('@shared/schemas/helper-tools-settings').HelperToolsSettings {
  return helperToolsSettingsSchema.parse(input)
}

export function validateDashboardLayoutSettings(
  input: DashboardLayoutSettings
): DashboardLayoutSettings {
  return dashboardLayoutSettingsSchema.parse(input)
}

export function validateSpeedLimitSettings(
  input: SpeedLimitSettings
): SpeedLimitSettings {
  return speedLimitSettingsSchema.parse(input)
}
