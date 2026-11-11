import { z } from 'zod'

export const networkInterfaceInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  addresses: z.array(z.string()),
  ipv4: z.string().optional(),
  ipv6: z.string().optional(),
  internal: z.boolean().default(false),
  isUp: z.boolean().default(true),
})

export type NetworkInterfaceInfo = z.infer<typeof networkInterfaceInfoSchema>

export const networkSettingsSchema = z.object({
  bindInterface: z.string().catch(''),
  killSwitch: z.boolean().catch(false),
})

export type NetworkSettings = z.infer<typeof networkSettingsSchema>

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  bindInterface: '',
  killSwitch: false,
}

export const killSwitchStatePayloadSchema = z.object({
  active: z.boolean(),
  reason: z.enum([
    'interface-down',
    'interface-restored',
    'disabled',
    'ip-changed',
  ]),
  interfaceName: z.string().optional(),
  ip: z.string().optional(),
})

export type KillSwitchStatePayload = z.infer<
  typeof killSwitchStatePayloadSchema
>
