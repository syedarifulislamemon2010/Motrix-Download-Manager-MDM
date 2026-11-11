import type os from 'node:os'
import { Events } from '@shared/protocol/events'
import type { NetworkSettings } from '@shared/schemas/network-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NetworkInterfaceMonitor,
  type NetworkInterfaceMonitorDeps,
} from './network-interface-monitor'

describe('NetworkInterfaceMonitor', () => {
  let settings: NetworkSettings
  let mockIfaces: Record<string, os.NetworkInterfaceInfo[] | undefined>
  let pausedTasks: string[]
  let resumedTasks: string[]
  let ipChanges: string[]
  let emittedEvents: Array<{ event: string; payload: unknown }>
  let deps: NetworkInterfaceMonitorDeps
  let monitor: NetworkInterfaceMonitor

  beforeEach(() => {
    settings = {
      bindInterface: 'WireGuard',
      killSwitch: true,
    }

    mockIfaces = {
      WireGuard: [
        {
          address: '10.14.0.2',
          netmask: '255.255.255.255',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '10.14.0.2/32',
        },
      ],
    }

    pausedTasks = []
    resumedTasks = []
    ipChanges = []
    emittedEvents = []

    deps = {
      getNetworkSettings: () => settings,
      listInterfaces: () => mockIfaces,
      pauseTasks: vi.fn(async () => {
        pausedTasks.push('task-1', 'task-2')
        return ['task-1', 'task-2']
      }),
      resumeTasks: vi.fn(async (ids) => {
        resumedTasks.push(...ids)
      }),
      onIpChanged: vi.fn(async (ip) => {
        ipChanges.push(ip)
      }),
      eventBus: {
        emit: vi.fn((event, payload) => {
          emittedEvents.push({ event, payload })
        }),
      },
    }

    monitor = new NetworkInterfaceMonitor(deps)
  })

  it('remains inactive when interface is up and running normally', async () => {
    await monitor.checkNow()
    expect(monitor.isKillSwitchActive()).toBe(false)
    expect(deps.pauseTasks).not.toHaveBeenCalled()
    expect(deps.resumeTasks).not.toHaveBeenCalled()
  })

  it('fails closed when interface goes down (pauses downloads, emits event)', async () => {
    // Initial check while interface is up
    await monitor.checkNow()
    expect(monitor.isKillSwitchActive()).toBe(false)

    // Interface disconnects / VPN drops
    mockIfaces = {}
    await monitor.checkNow()

    expect(monitor.isKillSwitchActive()).toBe(true)
    expect(deps.pauseTasks).toHaveBeenCalledOnce()
    expect(monitor.getPausedTaskIds()).toEqual(['task-1', 'task-2'])
    expect(emittedEvents).toContainEqual({
      event: Events.KillSwitchStateChanged,
      payload: expect.objectContaining({
        active: true,
        reason: 'interface-down',
        interfaceName: 'WireGuard',
      }),
    })
  })

  it('resumes paused downloads when interface recovers', async () => {
    // Interface is down initially
    mockIfaces = {}
    await monitor.checkNow()
    expect(monitor.isKillSwitchActive()).toBe(true)
    expect(deps.pauseTasks).toHaveBeenCalledOnce()

    // Interface is restored
    mockIfaces = {
      WireGuard: [
        {
          address: '10.14.0.2',
          netmask: '255.255.255.255',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '10.14.0.2/32',
        },
      ],
    }

    await monitor.checkNow()
    expect(monitor.isKillSwitchActive()).toBe(false)
    expect(deps.resumeTasks).toHaveBeenCalledWith(['task-1', 'task-2'])
    expect(monitor.getPausedTaskIds()).toEqual([])
    expect(emittedEvents).toContainEqual({
      event: Events.KillSwitchStateChanged,
      payload: expect.objectContaining({
        active: false,
        reason: 'interface-restored',
        interfaceName: 'WireGuard',
        ip: '10.14.0.2',
      }),
    })
  })

  it('notifies onIpChanged when interface IP changes', async () => {
    // Initial check
    await monitor.checkNow()

    // IP address changes
    mockIfaces = {
      WireGuard: [
        {
          address: '10.14.0.99',
          netmask: '255.255.255.255',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '10.14.0.99/32',
        },
      ],
    }

    await monitor.checkNow()
    expect(deps.onIpChanged).toHaveBeenCalledWith('10.14.0.99')
  })

  it('disengages and resumes downloads if killSwitch setting is turned off', async () => {
    // Interface is down
    mockIfaces = {}
    await monitor.checkNow()
    expect(monitor.isKillSwitchActive()).toBe(true)

    // User disables kill switch
    settings.killSwitch = false
    await monitor.checkNow()

    expect(monitor.isKillSwitchActive()).toBe(false)
    expect(deps.resumeTasks).toHaveBeenCalledWith(['task-1', 'task-2'])
    expect(emittedEvents).toContainEqual({
      event: Events.KillSwitchStateChanged,
      payload: expect.objectContaining({
        active: false,
        reason: 'disabled',
      }),
    })
  })
})
