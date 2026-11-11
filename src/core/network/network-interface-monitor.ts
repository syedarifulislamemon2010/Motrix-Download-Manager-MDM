import type os from 'node:os'
import type { EventBus } from '@core/events/event-bus'
import { getLogger } from '@core/logger'
import { Events } from '@shared/protocol/events'
import type { NetworkSettings } from '@shared/schemas/network-settings'
import { resolveInterfaceIp } from './network-interface-resolver'

export interface NetworkInterfaceMonitorDeps {
  getNetworkSettings: () => NetworkSettings
  listInterfaces?: () => Record<string, os.NetworkInterfaceInfo[] | undefined>
  pauseTasks: () => Promise<string[]>
  resumeTasks: (taskIds: string[]) => Promise<void>
  onIpChanged?: (newIp: string) => Promise<void>
  eventBus: Pick<EventBus, 'emit'>
  intervalMs?: number
}

export class NetworkInterfaceMonitor {
  private timer: NodeJS.Timeout | null = null
  private killSwitchActive = false
  private pausedTaskIds = new Set<string>()
  private lastBoundIp: string | null = null
  private checking = false
  private readonly intervalMs: number

  constructor(private readonly deps: NetworkInterfaceMonitorDeps) {
    this.intervalMs = deps.intervalMs ?? 2000
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive
  }

  getPausedTaskIds(): string[] {
    return Array.from(this.pausedTaskIds)
  }

  start(): void {
    if (this.timer) return
    // Initial check
    void this.checkNow()
    this.timer = setInterval(() => {
      void this.checkNow()
    }, this.intervalMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async checkNow(): Promise<void> {
    if (this.checking) return
    this.checking = true

    try {
      const settings = this.deps.getNetworkSettings()
      const ifaces = this.deps.listInterfaces?.()

      // If interface binding or kill-switch is disabled:
      if (!settings.bindInterface || !settings.killSwitch) {
        if (this.killSwitchActive) {
          this.killSwitchActive = false
          if (this.pausedTaskIds.size > 0) {
            const idsToResume = Array.from(this.pausedTaskIds)
            this.pausedTaskIds.clear()
            await this.deps.resumeTasks(idsToResume)
          }
          this.deps.eventBus.emit(Events.KillSwitchStateChanged, {
            active: false,
            reason: 'disabled',
          })
          getLogger('network-monitor').info(
            'kill-switch disengaged because network settings were disabled'
          )
        }
        this.lastBoundIp = resolveInterfaceIp(settings.bindInterface, ifaces)
        return
      }

      // Kill-switch is enabled and an interface is bound:
      const currentIp = resolveInterfaceIp(settings.bindInterface, ifaces)

      // Case 1: Interface is down / disconnected / no IP assigned
      if (currentIp === null) {
        if (!this.killSwitchActive) {
          this.killSwitchActive = true
          this.lastBoundIp = null
          getLogger('network-monitor').warn(
            { interface: settings.bindInterface },
            'fail-closed kill-switch engaged: bound interface is down'
          )
          const paused = await this.deps.pauseTasks()
          for (const id of paused) {
            this.pausedTaskIds.add(id)
          }
          this.deps.eventBus.emit(Events.KillSwitchStateChanged, {
            active: true,
            reason: 'interface-down',
            interfaceName: settings.bindInterface,
          })
        }
        return
      }

      // Case 2: Interface is up with a valid IP
      if (this.killSwitchActive) {
        this.killSwitchActive = false
        const ipChanged =
          this.lastBoundIp !== null && this.lastBoundIp !== currentIp
        this.lastBoundIp = currentIp

        getLogger('network-monitor').info(
          { interface: settings.bindInterface, ip: currentIp, ipChanged },
          'fail-closed kill-switch disengaged: bound interface is restored'
        )

        if (ipChanged && this.deps.onIpChanged) {
          await this.deps.onIpChanged(currentIp)
        }

        if (this.pausedTaskIds.size > 0) {
          const idsToResume = Array.from(this.pausedTaskIds)
          this.pausedTaskIds.clear()
          await this.deps.resumeTasks(idsToResume)
        }

        this.deps.eventBus.emit(Events.KillSwitchStateChanged, {
          active: false,
          reason: 'interface-restored',
          interfaceName: settings.bindInterface,
          ip: currentIp,
        })
        return
      }

      // Case 3: Live IP address changed while interface was up
      if (this.lastBoundIp !== null && this.lastBoundIp !== currentIp) {
        getLogger('network-monitor').info(
          {
            interface: settings.bindInterface,
            oldIp: this.lastBoundIp,
            newIp: currentIp,
          },
          'bound interface IP address changed'
        )
        this.lastBoundIp = currentIp
        if (this.deps.onIpChanged) {
          await this.deps.onIpChanged(currentIp)
        }
      } else {
        this.lastBoundIp = currentIp
      }
    } catch (error) {
      getLogger('network-monitor').error(
        { err: error },
        'unexpected error during network interface monitor check'
      )
    } finally {
      this.checking = false
    }
  }
}
