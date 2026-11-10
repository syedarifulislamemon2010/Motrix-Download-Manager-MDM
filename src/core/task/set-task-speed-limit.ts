import type { EngineAdapter } from '@core/engine/engine-adapter'
import type { EventBus } from '@core/events/event-bus'
import { getLogger } from '@core/logger'
import { computeEffectiveTaskLimits } from '@core/speed-limit/effective-limits'
import type { TaskManager } from '@core/task/task-manager'
import { AppError, ErrorCode } from '@shared/errors'
import { Events } from '@shared/protocol/events'
import { setTaskSpeedLimitSchema } from '@shared/schemas/task-speed-limit'
import type { SpeedLimitProfile } from '@shared/types/settings'
import type { DownloadTask } from '@shared/types/task'

const log = getLogger('SetTaskSpeedLimitHandler')

export interface SetTaskSpeedLimitDeps {
  authorizeTaskWrite?: (task: DownloadTask) => Promise<void>
  taskManager: Pick<TaskManager, 'getById' | 'set'>
  engine: Pick<EngineAdapter, 'changeOption'>
  persistTask: (task: DownloadTask) => Promise<void>
  eventBus: Pick<EventBus, 'emit'>
  getGlobalSpeedLimits?: () => SpeedLimitProfile
  runTaskMutation?: <T>(
    taskIds: readonly string[],
    operation: () => Promise<T>
  ) => Promise<T>
}

export function createSetTaskSpeedLimitHandler(deps: SetTaskSpeedLimitDeps) {
  return async function setTaskSpeedLimit(rawPayload: unknown): Promise<void> {
    const parsed = setTaskSpeedLimitSchema.safeParse(rawPayload)
    if (!parsed.success) {
      throw new AppError(
        ErrorCode.IpcInvalidPayload,
        parsed.error.issues[0]?.message ?? 'Invalid speed limit payload'
      )
    }
    const { taskId, download, upload } = parsed.data

    const mutationRunner = deps.runTaskMutation ?? ((_, op) => op())

    await mutationRunner([taskId], async () => {
      const task = deps.taskManager.getById(taskId)
      if (!task) {
        throw new AppError(ErrorCode.TaskNotFound, `Task ${taskId} not found`)
      }

      await deps.authorizeTaskWrite?.(task)

      const newDlLimit = download !== undefined ? download : task.dlLimit
      const newUlLimit = upload !== undefined ? upload : task.ulLimit

      const globalLimits = deps.getGlobalSpeedLimits?.() ?? {
        download: 0,
        upload: 0,
      }
      const effective = computeEffectiveTaskLimits(
        { download: newDlLimit, upload: newUlLimit },
        globalLimits
      )

      if (task.engineTaskId) {
        await deps.engine.changeOption(task.engineTaskId, {
          'max-download-limit': String(effective.download),
          'max-upload-limit': String(effective.upload),
        })
      }

      const updatedInstances =
        task.instances.length > 0
          ? task.instances.map((inst, idx) =>
              idx === 0
                ? {
                    ...inst,
                    payload: {
                      ...inst.payload,
                      dlLimit: newDlLimit,
                      ulLimit: newUlLimit,
                    },
                  }
                : inst
            )
          : task.instances

      const updatedTask: DownloadTask = {
        ...task,
        dlLimit: newDlLimit,
        ulLimit: newUlLimit,
        instances: updatedInstances,
        updatedAt: Date.now(),
      }

      deps.taskManager.set(taskId, updatedTask)
      await deps.persistTask(updatedTask)
      deps.eventBus.emit(Events.TaskUpdated, updatedTask)

      log.info(
        {
          taskId,
          dlLimit: newDlLimit,
          ulLimit: newUlLimit,
          effectiveDl: effective.download,
          effectiveUl: effective.upload,
        },
        'task speed limit updated'
      )
    })
  }
}
