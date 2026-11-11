import os from 'node:os'
import type { NetworkInterfaceInfo } from '@shared/schemas/network-settings'

type OsInterfaceDict = Record<string, os.NetworkInterfaceInfo[] | undefined>

/**
 * Checks if a string is a valid IPv4 or IPv6 address.
 */
export function isIpAddress(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  // IPv4
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Regex.test(trimmed)) return true
  // IPv6
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
  return ipv6Regex.test(trimmed)
}

/**
 * Lists all active network interfaces and their addresses from the host OS.
 */
export function listNetworkInterfaces(
  ifaces: OsInterfaceDict = os.networkInterfaces()
): NetworkInterfaceInfo[] {
  const result: NetworkInterfaceInfo[] = []

  for (const [name, list] of Object.entries(ifaces)) {
    if (!list || list.length === 0) continue

    const addresses: string[] = []
    let ipv4: string | undefined
    let ipv6: string | undefined
    let isInternal = true

    for (const info of list) {
      addresses.push(info.address)
      if (!info.internal) isInternal = false

      const fam = String(info.family)
      if (fam === 'IPv4' || fam === '4') {
        if (!ipv4 || !info.internal) {
          ipv4 = info.address
        }
      } else if (fam === 'IPv6' || fam === '6') {
        if (!ipv6 || !info.internal) {
          ipv6 = info.address
        }
      }
    }

    result.push({
      id: name,
      name,
      addresses,
      ipv4,
      ipv6,
      internal: isInternal,
      isUp: addresses.length > 0 && !isInternal,
    })
  }

  // Sort external interfaces first, then by name
  return result.sort((a, b) => {
    if (a.internal !== b.internal) return a.internal ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Resolves a configured bind interface (either interface name or IP) to
 * a concrete IP address usable by aria2.
 *
 * Windows requires an IP address for socket binding; passing an interface name
 * directly fails. If the interface is disconnected, absent, or has no IP,
 * returns null.
 */
export function resolveInterfaceIp(
  bindInterface: string,
  ifaces: OsInterfaceDict = os.networkInterfaces()
): string | null {
  const target = bindInterface.trim()
  if (!target) return null

  // If user configured a direct IP address:
  if (isIpAddress(target)) {
    for (const list of Object.values(ifaces)) {
      if (!list) continue
      const match = list.find((item) => item.address === target)
      if (match) return target
    }
    // Configured IP is not currently assigned to any active adapter
    return null
  }

  // Look up by adapter / interface name (case-insensitive for robustness on Windows)
  const entry = Object.entries(ifaces).find(
    ([name]) => name.toLowerCase() === target.toLowerCase()
  )

  if (!entry?.[1] || entry[1].length === 0) {
    return null
  }

  const list = entry[1]

  // Prefer external IPv4
  const externalIpv4 = list.find(
    (item) =>
      !item.internal &&
      (item.family === 'IPv4' || (item.family as unknown) === 4)
  )
  if (externalIpv4) return externalIpv4.address

  // Fallback to external IPv6
  const externalIpv6 = list.find(
    (item) =>
      !item.internal &&
      (item.family === 'IPv6' || (item.family as unknown) === 6)
  )
  if (externalIpv6) return externalIpv6.address

  // Fallback to any IPv4 on the interface
  const anyIpv4 = list.find(
    (item) => item.family === 'IPv4' || (item.family as unknown) === 4
  )
  if (anyIpv4) return anyIpv4.address

  // Fallback to any IPv6
  const anyIpv6 = list.find(
    (item) => item.family === 'IPv6' || (item.family as unknown) === 6
  )
  return anyIpv6 ? anyIpv6.address : null
}
