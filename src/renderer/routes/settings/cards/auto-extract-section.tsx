import { AddIcon, RefreshIcon, RemoveIcon } from '@renderer/components/icons'
import { SettingsFormRow } from '@renderer/components/settings-kit/settings-form-row'
import { SettingsSelectTrigger } from '@renderer/components/settings-kit/settings-select-trigger'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { transport } from '@renderer/lib/transport'
import { Commands } from '@shared/protocol/commands'
import { Events } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import {
  type AutoExtractMode,
  type AutoExtractSettings,
  DEFAULT_AUTO_EXTRACT_SETTINGS,
} from '@shared/schemas/auto-extract-settings'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function AutoExtractSection({
  disabled = false,
}: {
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AutoExtractSettings>(
    DEFAULT_AUTO_EXTRACT_SETTINGS
  )
  const [detectorStatus, setDetectorStatus] = useState<{
    available: boolean
    executablePath: string | null
  }>({ available: false, executablePath: null })
  const [newPassword, setNewPassword] = useState('')
  const [detecting, setDetecting] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const res = (await transport.invoke(
        Queries.GetAutoExtractSettings
      )) as AutoExtractSettings
      if (res) {
        setSettings(res)
      }
    } catch {
      // Ignored
    }
  }, [])

  const check7z = useCallback(async () => {
    setDetecting(true)
    try {
      const status = (await transport.invoke(Queries.Detect7zStatus)) as {
        available: boolean
        executablePath: string | null
      }
      if (status) {
        setDetectorStatus(status)
      }
    } catch {
      // Ignored
    } finally {
      setDetecting(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
    void check7z()

    const onSettingsChanged = () => {
      void loadSettings()
      void check7z()
    }

    transport.on(Events.SettingsChanged, onSettingsChanged)

    return () => {
      transport.off(Events.SettingsChanged, onSettingsChanged)
    }
  }, [loadSettings, check7z])

  const updateSettings = async (patch: Partial<AutoExtractSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    try {
      await transport.invoke(Commands.SaveAutoExtractSettings, patch)
      if (patch.custom7zPath !== undefined) {
        void check7z()
      }
    } catch {
      void loadSettings()
    }
  }

  const addPassword = () => {
    const trimmed = newPassword.trim()
    if (!trimmed || settings.passwordList.includes(trimmed)) return
    const nextList = [...settings.passwordList, trimmed]
    void updateSettings({ passwordList: nextList })
    setNewPassword('')
  }

  const removePassword = (pwd: string) => {
    const nextList = settings.passwordList.filter((p) => p !== pwd)
    void updateSettings({ passwordList: nextList })
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {t('settings.downloads.autoExtract.title')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('settings.downloads.autoExtract.description')}
          </p>
        </div>
      </div>

      {/* Main enable switch */}
      <SettingsFormRow>
        <div className="space-y-1">
          <Label>{t('settings.downloads.autoExtract.enable')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.downloads.autoExtract.enableDesc')}
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => void updateSettings({ enabled })}
        />
      </SettingsFormRow>

      {settings.enabled && (
        <div className="space-y-4 pl-2 border-l-2 border-muted">
          {/* Destination mode */}
          <SettingsFormRow>
            <div className="space-y-1">
              <Label>{t('settings.downloads.autoExtract.mode')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.downloads.autoExtract.modeDesc')}
              </p>
            </div>
            <Select
              value={settings.mode}
              disabled={disabled}
              onValueChange={(val) =>
                void updateSettings({ mode: val as AutoExtractMode })
              }
            >
              <SettingsSelectTrigger className="w-48">
                <SelectValue />
              </SettingsSelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="subfolder">
                    {t('settings.downloads.autoExtract.modeSubfolder')}
                  </SelectItem>
                  <SelectItem value="in_place">
                    {t('settings.downloads.autoExtract.modeInPlace')}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingsFormRow>

          {/* Formats support */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              {t('settings.downloads.autoExtract.formats')}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <SettingsFormRow className="justify-between p-2 rounded-md border border-border">
                <span className="text-xs font-medium">ZIP</span>
                <Switch
                  size="sm"
                  checked={settings.formats.zip}
                  disabled={disabled}
                  onCheckedChange={(zip) =>
                    void updateSettings({
                      formats: { ...settings.formats, zip },
                    })
                  }
                />
              </SettingsFormRow>

              <SettingsFormRow className="justify-between p-2 rounded-md border border-border">
                <span className="text-xs font-medium">7-Zip (7z)</span>
                <Switch
                  size="sm"
                  checked={settings.formats.sevenZip}
                  disabled={disabled}
                  onCheckedChange={(sevenZip) =>
                    void updateSettings({
                      formats: { ...settings.formats, sevenZip },
                    })
                  }
                />
              </SettingsFormRow>

              <SettingsFormRow className="justify-between p-2 rounded-md border border-border">
                <span className="text-xs font-medium">RAR</span>
                <Switch
                  size="sm"
                  checked={settings.formats.rar}
                  disabled={disabled}
                  onCheckedChange={(rar) =>
                    void updateSettings({
                      formats: { ...settings.formats, rar },
                    })
                  }
                />
              </SettingsFormRow>
            </div>
          </div>

          {/* Delete archive after extract */}
          <SettingsFormRow>
            <div className="space-y-1">
              <Label>{t('settings.downloads.autoExtract.deleteArchive')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.downloads.autoExtract.deleteArchiveDesc')}
              </p>
            </div>
            <Switch
              checked={settings.deleteArchiveAfterExtract}
              disabled={disabled}
              onCheckedChange={(deleteArchiveAfterExtract) =>
                void updateSettings({ deleteArchiveAfterExtract })
              }
            />
          </SettingsFormRow>

          {/* 7-Zip Executable Path */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">
                  {t('settings.downloads.autoExtract.sevenZipPath')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.downloads.autoExtract.sevenZipPathDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {detectorStatus.available ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500 text-emerald-600 dark:text-emerald-400 text-[10px]"
                  >
                    {t('settings.downloads.autoExtract.sevenZipFound')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500 text-amber-600 dark:text-amber-400 text-[10px]"
                  >
                    {t('settings.downloads.autoExtract.sevenZipNotFound')}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => void check7z()}
                  disabled={detecting}
                  title={t('common.refresh')}
                >
                  <RefreshIcon
                    className={`h-3 w-3 ${detecting ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>
            </div>
            <Input
              value={settings.custom7zPath}
              placeholder={
                detectorStatus.executablePath ||
                t(
                  'settings.downloads.autoExtract.sevenZipAutoDetectPlaceholder'
                )
              }
              disabled={disabled}
              onChange={(e) =>
                void updateSettings({ custom7zPath: e.target.value })
              }
              className="text-xs font-mono"
            />
            {detectorStatus.executablePath && (
              <p className="text-[11px] text-muted-foreground truncate">
                {t('settings.downloads.autoExtract.activeBinary')}:{' '}
                {detectorStatus.executablePath}
              </p>
            )}
          </div>

          {/* Passwords list */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              {t('settings.downloads.autoExtract.passwords')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.downloads.autoExtract.passwordsDesc')}
            </p>

            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={t(
                  'settings.downloads.autoExtract.passwordPlaceholder'
                )}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addPassword()
                  }
                }}
                disabled={disabled}
                className="text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPassword}
                disabled={disabled || !newPassword.trim()}
              >
                <AddIcon className="h-3 w-3 mr-1" />
                {t('common.add')}
              </Button>
            </div>

            {settings.passwordList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {settings.passwordList.map((pwd) => (
                  <Badge
                    key={pwd}
                    variant="secondary"
                    className="flex items-center gap-1 text-xs py-0.5 px-2 font-mono"
                  >
                    <span>{pwd}</span>
                    <button
                      type="button"
                      onClick={() => removePassword(pwd)}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={disabled}
                      aria-label={t('common.remove')}
                    >
                      <RemoveIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
