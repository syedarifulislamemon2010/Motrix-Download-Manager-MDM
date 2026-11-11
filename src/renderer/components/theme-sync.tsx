import {
  onSettingsRefresh,
  type SettingsReader,
} from '@renderer/lib/settings-refresh'
import { transport } from '@renderer/lib/transport'
import { fnosSdk, isFnos, watchFnosPlatform } from '@renderer/platform/fnos'
import { useThemeManager } from '@renderer/themes/theme-manager'
import { Queries } from '@shared/protocol/queries'
import type { AppSettings } from '@shared/types/settings'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

// Read back the persisted theme on mount and after saving, including when
// the browser event connection is unavailable.
export function ThemeSync() {
  const { setTheme } = useTheme()
  const activeTheme = useThemeManager((s) => s.getActiveTheme())

  useEffect(() => {
    if (activeTheme) {
      setTheme(activeTheme.variant)
    }
  }, [activeTheme, setTheme])

  useEffect(() => {
    let cancelled = false
    let generation = 0
    const reconcile = async (
      read: SettingsReader = (channel) => transport.invoke(channel)
    ) => {
      const current = ++generation
      const data = await read(Queries.GetSettings)
      if (cancelled || current !== generation) return
      const all = data as AppSettings | undefined
      const theme = all?.app?.theme
      if (!useThemeManager.getState().getActiveTheme()) {
        if (theme === 'system' && isFnos()) {
          const config = await (await fnosSdk()).getPlatformConfig()
          if (!cancelled && current === generation) setTheme(config.theme)
          return
        }
        if (theme) setTheme(theme)
      }
    }
    const refresh = () => void reconcile().catch(() => {})
    const stopFnosSync = watchFnosPlatform('os/theme', refresh)
    window.addEventListener('focus', refresh)
    const stopSettingsSync = onSettingsRefresh(reconcile)
    const stopConnectionSync = transport.onConnectionChange?.((event) => {
      if (event.state === 'connected') refresh()
    })
    refresh()
    return () => {
      cancelled = true
      stopFnosSync()
      window.removeEventListener('focus', refresh)
      stopSettingsSync()
      stopConnectionSync?.()
    }
  }, [setTheme])

  return null
}
