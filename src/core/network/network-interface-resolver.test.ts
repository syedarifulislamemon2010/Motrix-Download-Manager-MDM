import type os from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  isIpAddress,
  listNetworkInterfaces,
  resolveInterfaceIp,
} from './network-interface-resolver'

const mockInterfaces: Record<string, os.NetworkInterfaceInfo[]> = {
  Ethernet: [
    {
      address: 'fe80::1',
      netmask: 'ffff:ffff:ffff:ffff::',
      family: 'IPv6',
      mac: '00:11:22:33:44:55',
      internal: false,
      cidr: 'fe80::1/64',
      scopeid: 1,
    },
    {
      address: '192.168.1.100',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:11:22:33:44:55',
      internal: false,
      cidr: '192.168.1.100/24',
    },
  ],
  'Wi-Fi': [
    {
      address: '10.0.0.50',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:ff',
      internal: false,
      cidr: '10.0.0.50/24',
    },
  ],
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
  'Loopback Pseudo-Interface 1': [
    {
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '127.0.0.1/8',
    },
  ],
}

describe('network-interface-resolver', () => {
  it('correctly identifies valid IPv4 and IPv6 strings', () => {
    expect(isIpAddress('192.168.1.1')).toBe(true)
    expect(isIpAddress('10.0.0.2')).toBe(true)
    expect(isIpAddress('::1')).toBe(true)
    expect(isIpAddress('fe80::1')).toBe(true)
    expect(isIpAddress('Ethernet')).toBe(false)
    expect(isIpAddress('not-an-ip')).toBe(false)
    expect(isIpAddress('')).toBe(false)
  })

  it('lists active network interfaces', () => {
    const list = listNetworkInterfaces(mockInterfaces)
    expect(list.length).toBe(4)
    const ethernet = list.find((i) => i.name === 'Ethernet')
    expect(ethernet).toBeDefined()
    expect(ethernet?.ipv4).toBe('192.168.1.100')
    expect(ethernet?.internal).toBe(false)
    expect(ethernet?.isUp).toBe(true)
  })

  it('resolves interface name to its IPv4 address', () => {
    expect(resolveInterfaceIp('Ethernet', mockInterfaces)).toBe('192.168.1.100')
    expect(resolveInterfaceIp('Wi-Fi', mockInterfaces)).toBe('10.0.0.50')
    expect(resolveInterfaceIp('WireGuard', mockInterfaces)).toBe('10.14.0.2')
  })

  it('is case-insensitive when matching interface names', () => {
    expect(resolveInterfaceIp('ethernet', mockInterfaces)).toBe('192.168.1.100')
    expect(resolveInterfaceIp('WI-FI', mockInterfaces)).toBe('10.0.0.50')
    expect(resolveInterfaceIp('wireguard', mockInterfaces)).toBe('10.14.0.2')
  })

  it('resolves direct IP if currently present on an adapter', () => {
    expect(resolveInterfaceIp('192.168.1.100', mockInterfaces)).toBe(
      '192.168.1.100'
    )
    expect(resolveInterfaceIp('10.14.0.2', mockInterfaces)).toBe('10.14.0.2')
  })

  it('returns null when interface or IP is not found or disconnected', () => {
    expect(resolveInterfaceIp('NonExistent', mockInterfaces)).toBeNull()
    expect(resolveInterfaceIp('172.16.0.99', mockInterfaces)).toBeNull()
    expect(resolveInterfaceIp('', mockInterfaces)).toBeNull()
    expect(resolveInterfaceIp('   ', mockInterfaces)).toBeNull()
  })

  it('returns IPv6 if interface has only IPv6', () => {
    const ipv6Only: Record<string, os.NetworkInterfaceInfo[]> = {
      tun0: [
        {
          address: '2001:db8::1',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '2001:db8::1/64',
          scopeid: 0,
        },
      ],
    }
    expect(resolveInterfaceIp('tun0', ipv6Only)).toBe('2001:db8::1')
  })
})
