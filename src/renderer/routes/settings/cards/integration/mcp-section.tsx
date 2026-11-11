import { CopyButton } from '@renderer/components/desktop-kit/copy-button'
import { RefreshIcon, RemoveIcon } from '@renderer/components/icons'
import { SettingsFormRow } from '@renderer/components/settings-kit/settings-form-row'
import { SettingsSelectTrigger } from '@renderer/components/settings-kit/settings-select-trigger'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@renderer/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { transport } from '@renderer/lib/transport'
import { Commands } from '@shared/protocol/commands'
import { Events } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import type {
  McpAuditEntry,
  McpPermissionTier,
} from '@shared/schemas/mcp-settings'
import { useCallback, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { IntegrationFormValues } from './integration-dialog'

const MCP_CLIENT_CONFIG_SNIPPET = JSON.stringify(
  {
    mcpServers: {
      motrix: {
        command: 'motrix',
        args: ['mcp'],
      },
    },
  },
  null,
  2
)

export function McpSection() {
  const { t } = useTranslation()
  const form = useFormContext<IntegrationFormValues>()
  const [logs, setLogs] = useState<McpAuditEntry[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const enabled = form.watch('mcp.enabled') ?? false
  const permissionTier = (form.watch('mcp.permissionTier') ??
    'standard') as McpPermissionTier

  const refreshLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const result = await transport.invoke(Queries.GetMcpAuditLogs, {
        limit: 50,
      })
      if (Array.isArray(result)) {
        setLogs(result)
      }
    } catch {
      // Ignored
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  const clearLogs = useCallback(async () => {
    try {
      await transport.invoke(Commands.ClearMcpAuditLogs)
      setLogs([])
    } catch {
      // Ignored
    }
  }, [])

  useEffect(() => {
    void refreshLogs()

    const onLogAdded = () => {
      void refreshLogs()
    }

    transport.on(Events.McpAuditLogAdded, onLogAdded)
    return () => {
      transport.off(Events.McpAuditLogAdded, onLogAdded)
    }
  }, [refreshLogs])

  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={form.control}
        name="mcp.enabled"
        render={({ field }) => (
          <SettingsFormRow>
            <div className="space-y-0.5">
              <FormLabel className="text-sm font-medium">
                {t('settings.integration.mcp.enableTitle')}
              </FormLabel>
              <FormDescription className="text-xs text-muted-foreground">
                {t('settings.integration.mcp.enableDesc')}
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </SettingsFormRow>
        )}
      />

      <FormField
        control={form.control}
        name="mcp.permissionTier"
        render={({ field }) => (
          <SettingsFormRow>
            <div className="space-y-0.5">
              <FormLabel className="text-sm font-medium">
                {t('settings.integration.mcp.permissionTierTitle')}
              </FormLabel>
              <FormDescription className="text-xs text-muted-foreground">
                {t('settings.integration.mcp.permissionTierDesc')}
              </FormDescription>
            </div>
            <FormControl>
              <Select
                value={field.value ?? 'standard'}
                onValueChange={field.onChange}
                disabled={!enabled}
              >
                <SettingsSelectTrigger className="w-[180px]">
                  <SelectValue />
                </SettingsSelectTrigger>
                <SelectContent position="popper" align="end">
                  <SelectGroup>
                    <SelectItem value="read_only">
                      {t('settings.integration.mcp.tierReadOnly')}
                    </SelectItem>
                    <SelectItem value="standard">
                      {t('settings.integration.mcp.tierStandard')}
                    </SelectItem>
                    <SelectItem value="full">
                      {t('settings.integration.mcp.tierFull')}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormControl>
          </SettingsFormRow>
        )}
      />

      <FormField
        control={form.control}
        name="mcp.allowDeleteFiles"
        render={({ field }) => (
          <SettingsFormRow>
            <div className="space-y-0.5">
              <FormLabel className="text-sm font-medium">
                {t('settings.integration.mcp.allowDeleteFilesTitle')}
              </FormLabel>
              <FormDescription className="text-xs text-muted-foreground">
                {t('settings.integration.mcp.allowDeleteFilesDesc')}
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
                disabled={!enabled || permissionTier !== 'full'}
              />
            </FormControl>
          </SettingsFormRow>
        )}
      />

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {t('settings.integration.mcp.clientConfigTitle')}
          </span>
          <CopyButton
            size="xs"
            variant="outline"
            content={MCP_CLIENT_CONFIG_SNIPPET}
          >
            {t('common.copy')}
          </CopyButton>
        </div>
        <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px] text-muted-foreground">
          {MCP_CLIENT_CONFIG_SNIPPET}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-foreground">
            {t('settings.integration.mcp.auditTitle')}{' '}
            <span className="text-muted-foreground">({logs.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void refreshLogs()}
              disabled={loadingLogs}
              title={t('common.refresh')}
              data-testid="mcp-refresh-logs"
            >
              <RefreshIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void clearLogs()}
              disabled={logs.length === 0}
              title={t('common.clear')}
              data-testid="mcp-clear-logs"
            >
              <RemoveIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {t('settings.integration.mcp.auditEmpty')}
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto rounded border border-border">
            <div className="divide-y divide-border">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-1 p-2 text-xs hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.allowed ? 'outline' : 'destructive'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {entry.allowed ? 'ALLOWED' : 'DENIED'}
                      </Badge>
                      <code className="font-semibold text-foreground">
                        {entry.tool}
                      </code>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {entry.tier}
                      </Badge>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.summary && (
                    <div className="truncate text-muted-foreground font-mono text-[11px]">
                      {entry.summary}
                    </div>
                  )}
                  {entry.error && (
                    <div className="text-destructive text-[11px]">
                      {entry.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
