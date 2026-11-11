import { MiddleEllipsis } from '@renderer/components/desktop-kit/middle-ellipsis'
import { VirtualList } from '@renderer/components/desktop-kit/virtual-list/virtual-list'
import { Badge } from '@renderer/components/ui/badge'
import { useByteFormat } from '@renderer/hooks/use-byte-format'
import { useGeoIPStatus } from '@renderer/hooks/use-geoip-status'
import { useTaskServers } from '@renderer/hooks/use-task-servers'
import { countryCodeToFlag, countryName } from '@renderer/lib/country-flag'
import { cn } from '@renderer/lib/utils'
import type { TaskServer } from '@shared/types/server'
import type { DownloadTask } from '@shared/types/task'
import { TaskStatus } from '@shared/types/task'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const SERVER_LIVE_STATUSES = new Set<TaskStatus>([
  TaskStatus.Downloading,
  TaskStatus.Finalizing,
])

const ROW_HEIGHT = 28
const GRID_COLS_WITH_GEO =
  'grid-cols-[28px_36px_minmax(0,2fr)_minmax(0,3fr)_80px_72px]'
const GRID_COLS_BASE = 'grid-cols-[minmax(0,2fr)_minmax(0,3fr)_80px_72px]'

interface ServerRowProps {
  server: TaskServer
  locale: string
  showCountry: boolean
}

export function ServerRow({ server, locale, showCountry }: ServerRowProps) {
  const { formatSpeed } = useByteFormat()
  const flag = server.country ? countryCodeToFlag(server.country.code) : ''
  const code = server.country?.code ?? ''
  const fullName = server.country
    ? countryName(server.country.code, locale) || server.country.name
    : ''

  const endpoint = server.ip ? `${server.ip}:${server.port}` : '—'
  const latency =
    server.latencyMs !== null && server.latencyMs !== undefined
      ? `${Math.round(server.latencyMs)} ms`
      : '—'

  return (
    <div
      className={cn(
        'grid h-7',
        showCountry ? GRID_COLS_WITH_GEO : GRID_COLS_BASE,
        'items-center gap-3 px-3 text-xs tabular-nums',
        'border-b border-border/40 last:border-b-0'
      )}
    >
      {showCountry && (
        <>
          <span
            className="flex items-center justify-center text-sm leading-none"
            aria-hidden="true"
          >
            {flag}
          </span>
          <span
            className="font-mono text-muted-foreground"
            title={fullName || undefined}
          >
            {code || '—'}
          </span>
        </>
      )}

      <span className="truncate font-mono" title={endpoint}>
        {endpoint}
      </span>

      <span
        className="truncate text-muted-foreground font-mono text-[11px]"
        title={server.currentUri || server.uri}
      >
        <MiddleEllipsis text={server.currentUri || server.uri} maxChars={35} />
      </span>

      <span className="text-end font-mono">
        {server.downloadSpeed > 0 ? (
          formatSpeed(server.downloadSpeed)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>

      <span className="text-end font-mono text-xs">
        {server.latencyMs !== null && server.latencyMs !== undefined ? (
          <Badge
            variant="outline"
            className={cn(
              'px-1 py-0 text-[10px] font-mono',
              server.latencyMs < 100
                ? 'text-emerald-500 border-emerald-500/30'
                : server.latencyMs < 300
                  ? 'text-amber-500 border-amber-500/30'
                  : 'text-rose-500 border-rose-500/30'
            )}
          >
            {latency}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  )
}

export function ServersTab({ task }: { task: DownloadTask }) {
  const { t, i18n } = useTranslation()
  const { formatSpeed } = useByteFormat()
  const { status: geoipStatus } = useGeoIPStatus()
  const showCountry = Boolean(geoipStatus?.enabled && geoipStatus?.hasDatabase)

  const { servers } = useTaskServers(
    task.id,
    SERVER_LIVE_STATUSES.has(task.status)
  )

  const sorted = useMemo(() => {
    return [...servers].sort((a, b) => b.downloadSpeed - a.downloadSpeed)
  }, [servers])

  const summary = useMemo(() => {
    let totalDown = 0
    for (const s of servers) {
      totalDown += s.downloadSpeed
    }
    return {
      count: servers.length,
      totalDown,
    }
  }, [servers])

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('panel.downloads.inspector.servers.summary', {
            count: summary.count,
            defaultValue: `${summary.count} server(s)`,
          })}
        </span>
        <span className="tabular-nums">↓ {formatSpeed(summary.totalDown)}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-border">
        <div
          className={cn(
            'sticky top-0 z-10 grid shrink-0',
            showCountry ? GRID_COLS_WITH_GEO : GRID_COLS_BASE,
            'items-center gap-3 border-b border-border bg-background rounded-t-md',
            'px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground'
          )}
        >
          {showCountry && (
            <>
              <span aria-hidden="true" />
              <span>
                {t('panel.downloads.inspector.servers.col.country', {
                  defaultValue: 'Country',
                })}
              </span>
            </>
          )}
          <span>
            {t('panel.downloads.inspector.servers.col.endpoint', {
              defaultValue: 'Endpoint',
            })}
          </span>
          <span>
            {t('panel.downloads.inspector.servers.col.uri', {
              defaultValue: 'URI',
            })}
          </span>
          <span className="text-end">
            {t('panel.downloads.inspector.servers.col.down', {
              defaultValue: 'Down',
            })}
          </span>
          <span className="text-end">
            {t('panel.downloads.inspector.servers.col.latency', {
              defaultValue: 'Latency',
            })}
          </span>
        </div>
        {sorted.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">
            {t('panel.downloads.inspector.servers.empty', {
              defaultValue: 'No active download servers',
            })}
          </p>
        ) : (
          <VirtualList<TaskServer>
            scrollbar="custom"
            items={sorted}
            getId={(s) => s.id}
            rowHeight={ROW_HEIGHT}
            className="max-h-[200px]"
            renderRow={({ item }) => (
              <ServerRow
                server={item}
                locale={i18n.language}
                showCountry={showCountry}
              />
            )}
          />
        )}
      </div>
    </div>
  )
}
