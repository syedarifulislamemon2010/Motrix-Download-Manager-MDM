import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NETWORK_SETTINGS,
  killSwitchStatePayloadSchema,
  networkInterfaceInfoSchema,
  networkSettingsSchema,
} from './network-settings'

describe('networkSettingsSchema', () => {
  it('parses valid network settings', () => {
    const parsed = networkSettingsSchema.parse({
      bindInterface: 'Ethernet',
      killSwitch: true,
    })
    expect(parsed).toEqual({
      bindInterface: 'Ethernet',
      killSwitch: true,
    })
  })

  it('falls back to safe defaults when input is empty or invalid', () => {
    expect(networkSettingsSchema.parse({})).toEqual(DEFAULT_NETWORK_SETTINGS)
    expect(
      networkSettingsSchema.parse({
        bindInterface: 123,
        killSwitch: 'invalid',
      })
    ).toEqual(DEFAULT_NETWORK_SETTINGS)
  })

  it('validates NetworkInterfaceInfo structure', () => {
    const info = networkInterfaceInfoSchema.parse({
      id: 'eth0',
      name: 'Ethernet',
      addresses: ['192.168.1.10'],
      ipv4: '192.168.1.10',
      internal: false,
      isUp: true,
    })
    expect(info.id).toBe('eth0')
    expect(info.ipv4).toBe('192.168.1.10')
  })

  it('validates KillSwitchStatePayload structure', () => {
    const payload = killSwitchStatePayloadSchema.parse({
      active: true,
      reason: 'interface-down',
      interfaceName: 'Ethernet',
    })
    expect(payload.active).toBe(true)
    expect(payload.reason).toBe('interface-down')
  })
})
