import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { toast } from '@renderer/components/ui/toast'
import { invalidateTaskList } from '@renderer/hooks/use-task-list'
import { transport } from '@renderer/lib/transport'
import { CompactLimitInput } from '@renderer/routes/settings/cards/compact-limit-input'
import { Commands } from '@shared/protocol/commands'
import type { SpeedLimitUnit } from '@shared/schemas/speed-limit-units'
import type { DownloadTask } from '@shared/types/task'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function TaskSpeedLimitDialog({
  task,
  onClose,
}: {
  task: DownloadTask
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [downloadLimit, setDownloadLimit] = useState(task.dlLimit ?? 0)
  const [uploadLimit, setUploadLimit] = useState(task.ulLimit ?? 0)
  const [dlMagnitude, setDlMagnitude] = useState<SpeedLimitUnit>('kilo')
  const [ulMagnitude, setUlMagnitude] = useState<SpeedLimitUnit>('kilo')
  const [busy, setBusy] = useState(false)

  const handleApply = async () => {
    setBusy(true)
    try {
      await transport.invoke(Commands.SetTaskSpeedLimit, {
        taskId: task.id,
        download: downloadLimit,
        upload: uploadLimit,
      })
      invalidateTaskList()
      onClose()
    } catch {
      toast.add({
        title: t('panel.downloads.speedLimit.saveFailed'),
        type: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.downloads.speedLimit.title')}</DialogTitle>
          <DialogDescription className="truncate">
            {task.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-foreground">
              {t('task.add.dlLimit')}
            </span>
            <CompactLimitInput
              value={downloadLimit}
              onValueChange={setDownloadLimit}
              magnitude={dlMagnitude}
              onMagnitudeChange={setDlMagnitude}
              unitLabel={t('settings.downloads.speedLimit.unit')}
              zeroLabel={t('settings.downloads.speedLimit.unlimited')}
              resetLabel={t('settings.downloads.speedLimit.reset')}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-foreground">
              {t('task.add.ulLimit')}
            </span>
            <CompactLimitInput
              value={uploadLimit}
              onValueChange={setUploadLimit}
              magnitude={ulMagnitude}
              onMagnitudeChange={setUlMagnitude}
              unitLabel={t('settings.downloads.speedLimit.unit')}
              zeroLabel={t('settings.downloads.speedLimit.unlimited')}
              resetLabel={t('settings.downloads.speedLimit.reset')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            {t('button.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={handleApply} disabled={busy}>
            {t('button.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
