import { MiddleEllipsis } from '@renderer/components/desktop-kit/middle-ellipsis'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  ImageIcon,
  InstallIcon,
  RefreshIcon,
  TerminalIcon,
  VerifiedToolIcon,
  VideoIcon,
} from '@renderer/components/icons'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form'
import { Input } from '@renderer/components/ui/input'
import { Progress } from '@renderer/components/ui/progress'
import { Spinner } from '@renderer/components/ui/spinner'
import { useHelperBinary } from '@renderer/hooks/use-helper-binary'
import type { HelperBinaryId } from '@shared/schemas/helper-binary'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { IntegrationFormValues } from './integration-dialog'

interface ToolCardProps {
  id: HelperBinaryId
  name: string
  description: string
  icon: typeof VideoIcon
  formField:
    | 'helperTools.ytDlpBinaryPath'
    | 'helperTools.galleryDlBinaryPath'
    | 'helperTools.denoBinaryPath'
}

function HelperToolCard({
  id,
  name,
  description,
  icon: Icon,
  formField,
}: ToolCardProps) {
  const { t } = useTranslation()
  const form = useFormContext<IntegrationFormValues>()
  const { status, detection, installing, install, refresh } =
    useHelperBinary(id)
  const [editingPath, setEditingPath] = useState(false)

  const active = detection?.active
  const isInstalled = Boolean(active)
  const percent = status?.percent ?? 0
  const phase = status?.phase ?? 'idle'

  return (
    <div
      data-testid={`helper-tool-card-${id}`}
      className="space-y-3 rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
            <Icon className="size-5 text-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{name}</span>
              {isInstalled ? (
                <Badge variant="default" className="gap-1 text-xs">
                  <VerifiedToolIcon className="size-3" />
                  {active?.version}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {t('settings.integration.helperTools.notInstalled')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            {active && (
              <div className="text-xs text-muted-foreground/80 flex items-center gap-1 font-mono">
                <span className="text-muted-foreground/60">
                  {t('settings.integration.helperTools.path')}:
                </span>
                <MiddleEllipsis text={active.path} maxChars={40} />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={isInstalled ? 'outline' : 'default'}
            disabled={installing}
            onClick={() => void install()}
            className="gap-1.5"
          >
            {installing ? (
              <>
                <Spinner className="size-3.5" />
                <span>
                  {phase === 'extracting'
                    ? t('settings.integration.helperTools.extracting')
                    : `${percent}%`}
                </span>
              </>
            ) : isInstalled ? (
              <>
                <RefreshIcon className="size-3.5" />
                <span>{t('settings.integration.helperTools.update')}</span>
              </>
            ) : (
              <>
                <InstallIcon className="size-3.5" />
                <span>{t('settings.integration.helperTools.install')}</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title={t('settings.integration.helperTools.refresh')}
            onClick={() => void refresh()}
          >
            <RefreshIcon className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {installing && (
        <div className="space-y-1 pt-1">
          <Progress value={percent} className="h-1.5" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {phase === 'verifying'
                ? t('settings.integration.helperTools.verifying')
                : phase === 'extracting'
                  ? t('settings.integration.helperTools.extracting')
                  : t('settings.integration.helperTools.downloading')}
            </span>
            <span>{percent}%</span>
          </div>
        </div>
      )}

      {status?.error && (
        <p className="text-xs text-destructive">{status.error}</p>
      )}

      {form && (
        <Collapsible open={editingPath} onOpenChange={setEditingPath}>
          <CollapsibleTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {editingPath ? (
                  <ChevronDownIcon className="size-3" />
                ) : (
                  <ChevronRightIcon className="size-3" />
                )}
                <EditIcon className="size-3" />
                <span>
                  {t('settings.integration.helperTools.customPathToggle')}
                </span>
              </Button>
            }
          />
          <CollapsibleContent className="pt-2">
            <FormField
              control={form.control}
              name={formField}
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-normal text-muted-foreground">
                    {t('settings.integration.helperTools.customPathLabel', {
                      name,
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={t(
                        'settings.integration.helperTools.customPathPlaceholder',
                        { name }
                      )}
                      className="h-8 text-xs font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

export function HelperToolsSection() {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <HelperToolCard
        id="yt-dlp"
        name="yt-dlp"
        description={t('settings.integration.helperTools.ytdlpDesc')}
        icon={VideoIcon}
        formField="helperTools.ytDlpBinaryPath"
      />
      <HelperToolCard
        id="gallery-dl"
        name="gallery-dl"
        description={t('settings.integration.helperTools.gallerydlDesc')}
        icon={ImageIcon}
        formField="helperTools.galleryDlBinaryPath"
      />
      <HelperToolCard
        id="deno"
        name="Deno"
        description={t('settings.integration.helperTools.denoDesc')}
        icon={TerminalIcon}
        formField="helperTools.denoBinaryPath"
      />
    </div>
  )
}
