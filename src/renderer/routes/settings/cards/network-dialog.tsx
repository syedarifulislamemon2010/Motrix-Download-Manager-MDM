import { EndpointList } from '@renderer/components/settings-kit/endpoint-list'
import { SettingsFormRow } from '@renderer/components/settings-kit/settings-form-row'
import { SettingsSelectTrigger } from '@renderer/components/settings-kit/settings-select-trigger'
import {
  useSettingsForm,
  useSettingsSubmit,
} from '@renderer/components/settings-kit/use-settings-form'
import {
  SettingsLoadStatus,
  useSettingsLoad,
} from '@renderer/components/settings-kit/use-settings-load'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form'
import { Input } from '@renderer/components/ui/input'
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaViewport,
  ScrollBar,
} from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Separator } from '@renderer/components/ui/separator'
import { Switch } from '@renderer/components/ui/switch'
import { pickDirty } from '@renderer/lib/form-utils'
import { saveSettings } from '@renderer/lib/settings-save'
import { transport } from '@renderer/lib/transport'
import { Events } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import {
  DEFAULT_ENGINE_SETTINGS,
  DEFAULT_NAT_SETTINGS,
  DEFAULT_NETWORK_SETTINGS,
  DEFAULT_PROXY_SETTINGS,
  type KillSwitchStatePayload,
  type NetworkInterfaceInfo,
  type NetworkSettings,
} from '@shared/schemas'
import {
  portCheckerInputSchema,
  stunServerInputSchema,
} from '@shared/schemas/nat-settings'
import type {
  DnsResolutionMode,
  NatSettings,
  ProxySettings,
} from '@shared/types/settings'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SettingsCardDialogProps } from './card-types'
import { ProxySection } from './proxy-section'
import { networkFormSchema } from './settings-form-schemas'

export interface NetworkFields {
  proxy: ProxySettings
  nat: NatSettings
  network: NetworkSettings
  // Only the DNS slice of EngineSettings is edited here; the rest of the
  // engine namespace stays with the Downloads dialog.
  engine: { dnsMode: DnsResolutionMode }
}

// Source of truth: src/shared/schemas/{proxy,nat,network,engine}-settings.ts.
// Keep in sync with the corresponding DEFAULT_* exports.
const DEFAULTS: NetworkFields = {
  proxy: { ...DEFAULT_PROXY_SETTINGS },
  nat: { ...DEFAULT_NAT_SETTINGS },
  network: { ...DEFAULT_NETWORK_SETTINGS },
  engine: { dnsMode: DEFAULT_ENGINE_SETTINGS.dnsMode },
}

const NAT_PROTOCOL_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: 'PCP', value: 'pcp' },
  { label: 'NAT-PMP', value: 'natpmp' },
  { label: 'UPnP', value: 'upnp' },
] as const satisfies ReadonlyArray<{
  label: string
  value: NatSettings['preferredProtocol']
}>

export function NetworkDialog({
  open,
  onClose,
  labelKey,
}: SettingsCardDialogProps) {
  const { t } = useTranslation()
  const form = useSettingsForm<NetworkFields>(networkFormSchema, DEFAULTS)
  const diagnosticSwitches = form.watch([
    'nat.natTypeDetectionEnabled',
    'nat.portReachabilityCheckEnabled',
    'nat.autoDiagnostic',
  ])
  const [revealedDiagnosticFields, setRevealedDiagnosticFields] = useState({
    stun: false,
    ports: false,
    interval: false,
  })
  const natErrors = form.formState.errors.nat
  const stunFieldsInvalid = Boolean(natErrors?.stunServers)
  const portFieldsInvalid = Boolean(natErrors?.portCheckerEndpoints)
  const intervalInvalid = Boolean(natErrors?.diagnosticIntervalSec)

  // Keep invalid dependent fields visible while the user corrects them.
  useEffect(() => {
    if (stunFieldsInvalid || portFieldsInvalid || intervalInvalid) {
      setRevealedDiagnosticFields((previous) => ({
        stun: previous.stun || stunFieldsInvalid,
        ports: previous.ports || portFieldsInvalid,
        interval: previous.interval || intervalInvalid,
      }))
    }
  }, [stunFieldsInvalid, portFieldsInvalid, intervalInvalid])

  const dnsModeOptions = [
    { value: 'auto', label: t('settings.network.dns.modeAuto') },
    { value: 'system', label: t('settings.network.dns.modeSystem') },
    { value: 'engine', label: t('settings.network.dns.modeEngine') },
  ] as const

  const [availableInterfaces, setAvailableInterfaces] = useState<
    NetworkInterfaceInfo[]
  >([])
  const [killSwitchState, setKillSwitchState] =
    useState<KillSwitchStatePayload | null>(null)

  useEffect(() => {
    let active = true
    transport
      .invoke(Queries.GetNetworkInterfaces)
      .then((data) => {
        if (active && Array.isArray(data)) {
          setAvailableInterfaces(data as NetworkInterfaceInfo[])
        }
      })
      .catch(() => {})

    const onKillSwitch = (payload: unknown) => {
      setKillSwitchState(payload as KillSwitchStatePayload)
    }
    transport.on(Events.KillSwitchStateChanged, onKillSwitch)

    return () => {
      active = false
      transport.off(Events.KillSwitchStateChanged, onKillSwitch)
    }
  }, [])

  const load = useSettingsLoad((all) => {
    if (!all?.proxy || !all.nat) throw new Error('Missing settings baseline')
    if (all?.proxy && all?.nat) {
      form.reset({
        proxy: all.proxy,
        nat: all.nat,
        network: all.network ?? { ...DEFAULT_NETWORK_SETTINGS },
        engine: {
          dnsMode: all.engine?.dnsMode ?? DEFAULT_ENGINE_SETTINGS.dnsMode,
        },
      })
    }
  })

  const currentBind = form.watch('network.bindInterface')
  const interfaceOptions = [
    { value: '__all__', label: t('settings.network.interface.allInterfaces') },
    ...availableInterfaces.map((iface) => ({
      value: iface.name,
      label: iface.ipv4 ? `${iface.name} (${iface.ipv4})` : iface.name,
    })),
  ]
  if (currentBind && !availableInterfaces.some((i) => i.name === currentBind)) {
    interfaceOptions.push({
      value: currentBind,
      label: `${currentBind} (${t('settings.network.interface.offline')})`,
    })
  }

  const onSubmit = useSettingsSubmit(form, async (values) => {
    if (!load.ready) return
    // biome-ignore lint/suspicious/noExplicitAny: dirtyFields shape doesn't fit DirtyTree; cast is safe
    const dirty = pickDirty(values, form.formState.dirtyFields as any)
    if (!dirty) {
      onClose()
      return
    }
    await saveSettings(dirty)
    onClose()
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v, details) => {
        if (!v) {
          if (form.formState.isSubmitting) details.cancel()
          else onClose()
        }
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[700px]"
        initialFocus={false}
      >
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{t(labelKey)}</DialogTitle>
          <DialogDescription>
            {t('settings.network.description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ScrollAreaViewport
            tabIndex={-1}
            className="min-h-0 flex-1 overscroll-contain"
          >
            <ScrollAreaContent
              className="px-6 py-4"
              style={{ minWidth: '100%' }}
            >
              <SettingsLoadStatus {...load} />
              <Form {...form}>
                <form noValidate onSubmit={onSubmit}>
                  <fieldset
                    inert={!load.ready || form.formState.isSubmitting}
                    disabled={!load.ready || form.formState.isSubmitting}
                    className="min-w-0 space-y-4"
                  >
                    <ProxySection form={form} />

                    <Separator className="my-4" />

                    {/* DNS resolution */}
                    <h3 className="text-sm font-semibold text-foreground">
                      {t('settings.network.dns.title')}
                    </h3>
                    <FormField
                      control={form.control}
                      name="engine.dnsMode"
                      render={({ field }) => (
                        <SettingsFormRow className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <FormLabel>
                              {t('settings.network.dns.mode')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('settings.network.dns.modeDesc')}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Select
                              items={dnsModeOptions}
                              value={field.value}
                              onValueChange={(value) => {
                                if (value !== null) field.onChange(value)
                              }}
                            >
                              <SettingsSelectTrigger>
                                <SelectValue />
                              </SettingsSelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {dnsModeOptions.map(({ label, value }) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </SettingsFormRow>
                      )}
                    />

                    <Separator className="my-4" />

                    {/* Network interface binding & VPN kill-switch */}
                    <h3 className="text-sm font-semibold text-foreground">
                      {t('settings.network.interface.title')}
                    </h3>

                    {killSwitchState?.active && (
                      <div
                        role="alert"
                        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                      >
                        {t('settings.network.interface.killSwitchEngaged', {
                          adapter:
                            killSwitchState.interfaceName ||
                            form.watch('network.bindInterface'),
                        })}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="network.bindInterface"
                      render={({ field }) => (
                        <SettingsFormRow className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <FormLabel>
                              {t('settings.network.interface.bind')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('settings.network.interface.bindDesc')}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Select
                              items={interfaceOptions}
                              value={field.value || '__all__'}
                              onValueChange={(value) => {
                                field.onChange(value === '__all__' ? '' : value)
                              }}
                            >
                              <SettingsSelectTrigger className="w-full sm:w-[240px]">
                                <SelectValue />
                              </SettingsSelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {interfaceOptions.map(({ label, value }) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </SettingsFormRow>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="network.killSwitch"
                      render={({ field }) => (
                        <SettingsFormRow className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <FormLabel>
                              {t('settings.network.interface.killSwitch')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('settings.network.interface.killSwitchDesc')}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!form.watch('network.bindInterface')}
                            />
                          </FormControl>
                        </SettingsFormRow>
                      )}
                    />

                    <Separator className="my-4" />

                    {/* NAT mapping */}
                    {transport.platform !== 'web' && (
                      <>
                        <h3 className="text-sm font-semibold text-foreground">
                          {t('settings.network.nat.title')}
                        </h3>

                        <FormField
                          control={form.control}
                          name="nat.enabled"
                          render={({ field }) => (
                            <SettingsFormRow>
                              <div className="space-y-1">
                                <FormLabel>
                                  {t('settings.network.nat.enable')}
                                </FormLabel>
                                <FormDescription className="text-xs">
                                  {t('settings.network.nat.enableDesc')}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </SettingsFormRow>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="nat.preferredProtocol"
                          render={({ field }) => (
                            <SettingsFormRow>
                              <FormLabel>
                                {t('settings.network.nat.preferredProtocol')}
                              </FormLabel>
                              <FormControl>
                                <Select
                                  items={NAT_PROTOCOL_OPTIONS.map((option) => ({
                                    ...option,
                                    label:
                                      option.value === 'auto'
                                        ? t('settings.network.nat.automatic')
                                        : option.label,
                                  }))}
                                  value={field.value}
                                  onValueChange={(value) => {
                                    if (value !== null) field.onChange(value)
                                  }}
                                >
                                  <SelectTrigger className="w-30" size="sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {NAT_PROTOCOL_OPTIONS.map((option) => (
                                        <SelectItem
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.value === 'auto'
                                            ? t(
                                                'settings.network.nat.automatic'
                                              )
                                            : option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                            </SettingsFormRow>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="nat.mappingTtl"
                          render={({ field }) => (
                            <SettingsFormRow>
                              <FormLabel>
                                {t('settings.network.nat.mappingTtl')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min={1200}
                                  max={7200}
                                  className="w-30 h-8"
                                  value={
                                    Number.isFinite(field.value)
                                      ? field.value
                                      : ''
                                  }
                                  onChange={(event) =>
                                    field.onChange(event.target.valueAsNumber)
                                  }
                                />
                              </FormControl>
                            </SettingsFormRow>
                          )}
                        />

                        <Separator className="my-4" />

                        <h3 className="text-sm font-semibold text-foreground">
                          {t('settings.network.diagnostics')}
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <FormField
                              control={form.control}
                              name="nat.natTypeDetectionEnabled"
                              render={({ field }) => (
                                <SettingsFormRow>
                                  <div className="space-y-1">
                                    <FormLabel>
                                      {t('settings.network.stun.enable')}
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      {t('settings.network.stun.privacyHint')}
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </SettingsFormRow>
                              )}
                            />
                            <div
                              hidden={
                                !diagnosticSwitches[0] &&
                                !stunFieldsInvalid &&
                                !revealedDiagnosticFields.stun
                              }
                              className="border-s border-border/60 ps-4"
                            >
                              <FormField
                                control={form.control}
                                name="nat.stunServers"
                                render={() => (
                                  <FormItem className="space-y-2">
                                    <FormLabel>
                                      {t('settings.network.stun.servers')}
                                    </FormLabel>
                                    <EndpointList
                                      name="nat.stunServers"
                                      maxItems={10}
                                      itemSchema={stunServerInputSchema}
                                      placeholder="stun.example.com:3478"
                                      i18nKeys={{
                                        addButton:
                                          'settings.network.stun.addServer',
                                        empty: 'settings.network.stun.empty',
                                      }}
                                    />
                                    <FormMessage className="basis-full text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <FormField
                              control={form.control}
                              name="nat.portReachabilityCheckEnabled"
                              render={({ field }) => (
                                <SettingsFormRow>
                                  <div className="space-y-1">
                                    <FormLabel>
                                      {t(
                                        'settings.network.reachability.enable'
                                      )}
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      {t(
                                        'settings.network.reachability.privacyHint'
                                      )}
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </SettingsFormRow>
                              )}
                            />
                            <div
                              hidden={
                                !diagnosticSwitches[1] &&
                                !portFieldsInvalid &&
                                !revealedDiagnosticFields.ports
                              }
                              className="border-s border-border/60 ps-4"
                            >
                              <FormField
                                control={form.control}
                                name="nat.portCheckerEndpoints"
                                render={() => (
                                  <FormItem className="space-y-2">
                                    <FormLabel>
                                      {t(
                                        'settings.network.reachability.endpoints'
                                      )}
                                    </FormLabel>
                                    <EndpointList
                                      name="nat.portCheckerEndpoints"
                                      maxItems={5}
                                      itemSchema={portCheckerInputSchema}
                                      placeholder="https://example.com/check"
                                      i18nKeys={{
                                        addButton:
                                          'settings.network.reachability.addEndpoint',
                                        empty:
                                          'settings.network.reachability.empty',
                                      }}
                                    />
                                    <FormMessage className="basis-full text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <FormField
                              control={form.control}
                              name="nat.autoDiagnostic"
                              render={({ field }) => (
                                <SettingsFormRow>
                                  <div className="space-y-1">
                                    <FormLabel>
                                      {t('settings.network.diagnostic.enable')}
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      {t(
                                        'settings.network.diagnostic.enableDesc'
                                      )}
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </SettingsFormRow>
                              )}
                            />
                            <div
                              hidden={
                                !diagnosticSwitches[2] &&
                                !intervalInvalid &&
                                !revealedDiagnosticFields.interval
                              }
                              className="border-s border-border/60 ps-4"
                            >
                              <FormField
                                control={form.control}
                                name="nat.diagnosticIntervalSec"
                                render={({ field }) => (
                                  <SettingsFormRow>
                                    <FormLabel>
                                      {t(
                                        'settings.network.diagnostic.interval'
                                      )}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min={300}
                                        max={86400}
                                        className="w-30 h-8"
                                        value={
                                          Number.isFinite(field.value)
                                            ? field.value
                                            : ''
                                        }
                                        onChange={(event) =>
                                          field.onChange(
                                            event.target.valueAsNumber
                                          )
                                        }
                                      />
                                    </FormControl>
                                  </SettingsFormRow>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </fieldset>
                </form>
              </Form>
            </ScrollAreaContent>
          </ScrollAreaViewport>
          <ScrollBar />
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          {form.formState.errors.root?.save && (
            <p role="alert" className="me-auto text-xs text-destructive">
              {form.formState.errors.root.save.message}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={!load.ready || form.formState.isSubmitting}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
