import { CheckIcon } from '@renderer/components/icons/check'
import { RefreshIcon } from '@renderer/components/icons/refresh'
import { RemoveIcon } from '@renderer/components/icons/remove'
import { UploadIcon } from '@renderer/components/icons/upload'
import { WarningIcon } from '@renderer/components/icons/warning'
import { SettingsSelectTrigger } from '@renderer/components/settings-kit/settings-select-trigger'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from '@renderer/components/ui/select'
import { useThemeManager } from '@renderer/themes/theme-manager'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function ThemeManagerSection() {
  const { t } = useTranslation()
  const {
    activeThemeId,
    selectTheme,
    importTheme,
    deleteCustomTheme,
    exportTheme,
    contrastWarnings,
    getActiveTheme,
    getAllThemes,
  } = useThemeManager()

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeTheme = getActiveTheme()
  const { presets, custom } = getAllThemes()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const imported = importTheme(content, file.name)
        setFeedback({
          type: 'success',
          message: t('settings.appearance.themeManager.importSuccess', {
            name: imported.name,
          }),
        })
      } catch (err) {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : t('settings.appearance.themeManager.importError'),
        })
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.onerror = () => {
      setFeedback({
        type: 'error',
        message: t('settings.appearance.themeManager.importError'),
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const handleExport = (format: 'json' | 'base16' = 'json') => {
    if (!activeTheme) return
    try {
      exportTheme(activeTheme.id, format)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Export failed',
      })
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.yaml,.yml"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t('settings.appearance.themeManager.presetTitle')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.appearance.themeManager.presetDesc')}
          </p>
        </div>

        <Select
          value={activeThemeId}
          onValueChange={(val) => {
            if (val) selectTheme(val)
          }}
        >
          <SettingsSelectTrigger className="w-56">
            <SelectValue />
          </SettingsSelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="default">
                {t('settings.appearance.themeManager.defaultTheme')}
              </SelectItem>
            </SelectGroup>

            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-muted-foreground">
                {t('settings.appearance.themeManager.presetsGroup')}
              </SelectLabel>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.variant})
                </SelectItem>
              ))}
            </SelectGroup>

            {custom.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-semibold text-muted-foreground">
                  {t('settings.appearance.themeManager.customGroup')}
                </SelectLabel>
                {custom.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.variant})
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons: Import, Export, Reset */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="size-3.5" />
          {t('settings.appearance.themeManager.importButton')}
        </Button>

        {activeTheme && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleExport('json')}
            >
              {t('settings.appearance.themeManager.exportButton')}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleExport('base16')}
            >
              {t('settings.appearance.themeManager.exportBase16')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => selectTheme('default')}
            >
              <RefreshIcon className="size-3.5" />
              {t('settings.appearance.themeManager.resetButton')}
            </Button>
          </>
        )}

        {custom.some((c) => c.id === activeThemeId) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
            onClick={() => deleteCustomTheme(activeThemeId)}
          >
            <RemoveIcon className="size-3.5" />
            {t('common.delete')}
          </Button>
        )}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
            feedback.type === 'success'
              ? 'border border-primary/20 bg-primary/10 text-primary'
              : 'border border-destructive/20 bg-destructive/10 text-destructive'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <WarningIcon className="size-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Theme Preview Swatches */}
      {activeTheme && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {activeTheme.name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {activeTheme.author ? `${activeTheme.author} • ` : ''}
              {activeTheme.variant}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className="h-6 w-10 rounded border border-border/80 shadow-xs"
              style={{ backgroundColor: activeTheme.colors.background }}
              title="Background"
            />
            <div
              className="h-6 w-10 rounded border border-border/80 shadow-xs"
              style={{ backgroundColor: activeTheme.colors.card }}
              title="Card"
            />
            <div
              className="h-6 w-10 rounded border border-border/80 shadow-xs"
              style={{ backgroundColor: activeTheme.colors.primary }}
              title="Primary"
            />
            <div
              className="h-6 w-10 rounded border border-border/80 shadow-xs"
              style={{ backgroundColor: activeTheme.colors.accent }}
              title="Accent"
            />
            <div
              className="h-6 w-10 rounded border border-border/80 shadow-xs"
              style={{ backgroundColor: activeTheme.colors.sidebar }}
              title="Sidebar"
            />
            <div
              className="h-6 w-10 rounded border border-border/80 shadow-xs"
              style={{ backgroundColor: activeTheme.colors.destructive }}
              title="Destructive"
            />
          </div>

          {contrastWarnings.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-500">
              <WarningIcon className="size-3.5 shrink-0" />
              <span>
                {t('settings.appearance.themeManager.contrastWarning', {
                  count: contrastWarnings.length,
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
