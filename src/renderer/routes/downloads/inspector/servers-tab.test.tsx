import '@testing-library/jest-dom/vitest'
import '@renderer/lib/i18n'
import type { GeoIPStatus } from '@shared/types/geoip'
import type { TaskServer } from '@shared/types/server'
import { TaskStatus } from '@shared/types/task'
import { makeDownloadTask } from '@test-utils/task'
import { render } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ServersTab } from './servers-tab'

vi.mock('@renderer/components/desktop-kit/virtual-list/virtual-list', () => ({
  VirtualList: <T,>({
    items,
    getId,
    renderRow,
  }: {
    items: T[]
    getId: (item: T) => string
    renderRow: (props: { item: T; index: number }) => React.ReactNode
  }) => (
    <div data-testid="virtual-list-container">
      {items.map((item, index) => (
        <div key={getId(item)}>{renderRow({ item, index })}</div>
      ))}
    </div>
  ),
}))

const sampleServers: TaskServer[] = [
  {
    id: '93.184.216.34:443:https://example.com/file.iso',
    ip: '93.184.216.34',
    port: 443,
    uri: 'https://example.com/file.iso',
    currentUri: 'https://example.com/file.iso',
    downloadSpeed: 1048576,
    country: { code: 'US', name: 'United States' },
    latencyMs: 42,
  },
]

const baseStatus: GeoIPStatus = {
  enabled: true,
  hasDatabase: true,
  loaded: true,
  lastUpdatedAt: 0,
  databaseVersion: '2026',
  sizeBytes: 1000,
  isDownloading: false,
  lastError: null,
}

vi.mock('@renderer/hooks/use-task-servers', () => ({
  useTaskServers: () => ({ servers: sampleServers }),
}))

vi.mock('@renderer/hooks/use-geoip-status', () => ({
  useGeoIPStatus: () => ({
    enabled: true,
    hasDatabase: true,
    loaded: true,
    status: baseStatus,
  }),
}))

describe('ServersTab', () => {
  it('renders server list with IP, country flag, and latency', () => {
    const task = makeDownloadTask({
      id: 'task-http-1',
      status: TaskStatus.Downloading,
    })
    const { getByText } = render(<ServersTab task={task} />)

    expect(getByText('93.184.216.34:443')).toBeInTheDocument()
    expect(getByText('US')).toBeInTheDocument()
    expect(getByText('42 ms')).toBeInTheDocument()
  })
})
