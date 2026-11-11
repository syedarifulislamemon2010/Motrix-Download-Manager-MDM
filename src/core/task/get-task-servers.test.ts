import type { TaskServer } from '@shared/types/server'
import { describe, expect, it, vi } from 'vitest'
import { createGetTaskServersHandler } from './get-task-servers'

const SAMPLE_SERVER: TaskServer = {
  id: '93.184.216.34:443:https://example.com/file.iso',
  ip: '93.184.216.34',
  port: 443,
  uri: 'https://example.com/file.iso',
  currentUri: 'https://example.com/file.iso',
  downloadSpeed: 1048576,
}

const disabledGeoIP = {
  isEnabled: () => false,
  lookupCountry: vi.fn(),
}

describe('getTaskServers handler', () => {
  it('returns engine-reported servers without country when GeoIP is disabled', async () => {
    const engineAdapter = {
      getTaskServers: vi.fn().mockResolvedValue([SAMPLE_SERVER]),
    }
    const taskManager = {
      getById: vi.fn().mockReturnValue({ engineTaskId: 'gid-1' }),
    }
    const handler = createGetTaskServersHandler({
      engineAdapter,
      taskManager,
      geoipManager: disabledGeoIP,
    })
    const result = await handler({ taskId: 'task-1' })
    expect(result).toEqual([SAMPLE_SERVER])
    expect(disabledGeoIP.lookupCountry).not.toHaveBeenCalled()
    expect(engineAdapter.getTaskServers).toHaveBeenCalledWith('gid-1')
  })

  it('returns empty array without calling engine when task is unknown', async () => {
    const engineAdapter = { getTaskServers: vi.fn() }
    const taskManager = { getById: vi.fn().mockReturnValue(undefined) }
    const handler = createGetTaskServersHandler({
      engineAdapter,
      taskManager,
      geoipManager: disabledGeoIP,
    })
    expect(await handler({ taskId: 'missing' })).toEqual([])
    expect(engineAdapter.getTaskServers).not.toHaveBeenCalled()
  })

  it('injects country when GeoIP is enabled and lookup succeeds', async () => {
    const engineAdapter = {
      getTaskServers: vi.fn().mockResolvedValue([SAMPLE_SERVER]),
    }
    const taskManager = {
      getById: vi.fn().mockReturnValue({ engineTaskId: 'gid-1' }),
    }
    const geoipManager = {
      isEnabled: () => true,
      lookupCountry: vi.fn().mockReturnValue({
        code: 'US',
        name: 'United States',
      }),
    }
    const handler = createGetTaskServersHandler({
      engineAdapter,
      taskManager,
      geoipManager,
    })
    const result = await handler({ taskId: 'task-1' })
    expect(result).toEqual([
      {
        ...SAMPLE_SERVER,
        country: {
          code: 'US',
          name: 'United States',
        },
      },
    ])
    expect(geoipManager.lookupCountry).toHaveBeenCalledWith('93.184.216.34')
  })
})
