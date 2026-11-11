import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Logger } from '@core/logger'
import type { OccurrenceConsumer } from '@core/task/occurrences/occurrence-dispatcher'
import { type EventChannel, Events } from '@shared/protocol/events'
import type { AutoExtractSettings } from '@shared/schemas/auto-extract-settings'
import { type DownloadTask, TaskStatus } from '@shared/types/task'
import type { TaskOccurrence } from '@shared/types/task-occurrence'
import type { ArchiveService } from './archive-service'

export interface AutoExtractConsumerDeps {
  archiveService: ArchiveService
  getSettings: () => AutoExtractSettings
  getTask: (taskId: string) => DownloadTask | undefined
  eventBus: { emit: (channel: EventChannel, ...args: unknown[]) => void }
  log: Pick<Logger, 'info' | 'warn' | 'error'>
}

export function createAutoExtractOccurrenceConsumer(
  deps: AutoExtractConsumerDeps
): { name: 'auto-extract'; consume: OccurrenceConsumer } {
  const consume: OccurrenceConsumer = async (
    occ: TaskOccurrence
  ): Promise<void> => {
    if (occ.type !== 'terminal' || occ.toStatus !== TaskStatus.Completed) {
      return
    }

    const settings = deps.getSettings()
    if (!settings.enabled || settings.mode === 'off') {
      return
    }

    const task = deps.getTask(occ.taskId)
    if (!task) return

    // Resolve downloaded file path
    const candidatePaths: string[] = []
    if (task.finalPath) {
      candidatePaths.push(task.finalPath)
    }
    if (task.saveDir) {
      if (task.finalName) {
        candidatePaths.push(path.join(task.saveDir, task.finalName))
      }
      if (task.name) {
        candidatePaths.push(path.join(task.saveDir, task.name))
      }
    }

    let archivePath: string | null = null
    for (const candidate of candidatePaths) {
      if (
        existsSync(candidate) &&
        deps.archiveService.isSupportedArchive(candidate)
      ) {
        archivePath = candidate
        break
      }
    }

    if (!archivePath) {
      return
    }

    deps.log.info(
      { taskId: occ.taskId, archivePath },
      'auto-extract triggered for completed task'
    )

    try {
      const result = await deps.archiveService.extract(archivePath)

      deps.eventBus.emit(Events.ArchiveExtracted, {
        taskId: occ.taskId,
        archivePath,
        destinationDir: result.destinationDir,
        filesExtracted: result.filesExtracted,
        success: result.success,
        error: result.error,
      })

      if (result.success) {
        deps.log.info(
          {
            taskId: occ.taskId,
            destinationDir: result.destinationDir,
            filesExtracted: result.filesExtracted,
          },
          'auto-extract completed successfully'
        )
      } else {
        deps.log.warn(
          { taskId: occ.taskId, error: result.error },
          'auto-extract failed'
        )
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      deps.log.error(
        { taskId: occ.taskId, archivePath, err: errorMsg },
        'auto-extract exception'
      )
      deps.eventBus.emit(Events.ArchiveExtracted, {
        taskId: occ.taskId,
        archivePath,
        destinationDir: '',
        filesExtracted: 0,
        success: false,
        error: errorMsg,
      })
    }
  }

  return { name: 'auto-extract', consume }
}
