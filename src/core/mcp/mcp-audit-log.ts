import { randomUUID } from 'node:crypto'
import type { EventBus } from '@core/events/event-bus'
import { redactLogFields } from '@core/log-redact'
import { Events } from '@shared/protocol/events'
import type { McpAuditEntry, McpSettings } from '@shared/schemas/mcp-settings'

export interface McpAuditLogDeps {
  getSettings: () => McpSettings
  eventBus?: Pick<EventBus, 'emit'>
}

export class McpAuditLog {
  private readonly entries: McpAuditEntry[] = []

  constructor(private readonly deps: McpAuditLogDeps) {}

  record(
    input: Omit<McpAuditEntry, 'id' | 'timestamp'> & {
      id?: string
      timestamp?: number
    }
  ): McpAuditEntry {
    const maxEntries = Math.max(
      10,
      this.deps.getSettings().maxLogEntries ?? 100
    )

    // Redact any sensitive information in parameters
    let sanitizedParams: Record<string, unknown> | undefined
    if (input.params && typeof input.params === 'object') {
      try {
        sanitizedParams = redactLogFields(
          input.params as Record<string, unknown>,
          { profile: 'application' }
        ) as Record<string, unknown>
      } catch {
        sanitizedParams = { error: '[redaction-failed]' }
      }
    }

    const entry: McpAuditEntry = {
      id: input.id ?? randomUUID(),
      timestamp: input.timestamp ?? Date.now(),
      tool: input.tool,
      params: sanitizedParams,
      tier: input.tier,
      allowed: input.allowed,
      status: input.status,
      summary: input.summary,
      error: input.error,
    }

    this.entries.unshift(entry) // Newest first

    if (this.entries.length > maxEntries) {
      this.entries.length = maxEntries
    }

    this.deps.eventBus?.emit(Events.McpAuditLogAdded, entry)

    return entry
  }

  getEntries(): McpAuditEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries.length = 0
  }
}
