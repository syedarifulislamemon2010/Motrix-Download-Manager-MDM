import type { EngineAdapter } from '@core/engine/engine-adapter'
import type { EventBus } from '@core/events/event-bus'
import type { TaskManager } from '@core/task/task-manager'
import { AppError, ErrorCode } from '@shared/errors'
import { Events } from '@shared/protocol/events'
import {
  type DownloadTask,
  TaskInstancePhase,
  TaskStatus,
  TransitionPhase,
} from '@shared/types/task'
import { makeDownloadTask } from '@test-utils/task'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSetTaskSpeedLimitHandler,
  type SetTaskSpeedLimitDeps,
} from './set-task-speed-limit'

function makeTask(
  overrides?: Parameters<typeof makeDownloadTask>[0]
): DownloadTask {
  return makeDownloadTask({
    id: 'task-1',
    engineTaskId: 'gid-1',
    name: 'file.bin',
    dlLimit: 0,
    ulLimit: 0,
    instances: [
      {
        instanceId: 'inst-1',
        motrixId: 'task-1',
        gid: 'gid-1',
        phase: TaskInstancePhase.HttpDownload,
        status: TaskStatus.Downloading,
        progress: 50,
        totalBytes: 1000,
        downloadedBytes: 500,
        uploadedBytes: 0,
        diskPath: '/downloads/file.bin',
        transitionPhase: TransitionPhase.Idle,
        uris: ['http://example.com/file.bin'],
        uriHash: null,
        payload: {},
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    ...overrides,
  })
}

describe('createSetTaskSpeedLimitHandler', () => {
  let task: DownloadTask
  let taskManager: Pick<TaskManager, 'getById' | 'set'>
  let engine: Pick<EngineAdapter, 'changeOption'>
  let persistTask: (t: DownloadTask) => Promise<void>
  let eventBus: Pick<EventBus, 'emit'>
  let deps: SetTaskSpeedLimitDeps

  beforeEach(() => {
    task = makeTask()
    taskManager = {
      getById: vi.fn((id: string) => (id === task.id ? task : undefined)),
      set: vi.fn((id: string, updated: DownloadTask) => {
        if (id === task.id) task = updated
      }),
    }
    engine = {
      changeOption: vi.fn().mockResolvedValue(undefined),
    }
    persistTask = vi.fn().mockResolvedValue(undefined)
    eventBus = {
      emit: vi.fn(),
    }
    deps = {
      taskManager,
      engine,
      persistTask,
      eventBus,
      getGlobalSpeedLimits: () => ({ download: 2_000_000, upload: 500_000 }),
    }
  })

  it('sets speed limit on task and calls engine with min(task, global)', async () => {
    const handler = createSetTaskSpeedLimitHandler(deps)
    await handler({
      taskId: 'task-1',
      download: 500_000,
      upload: 100_000,
    })

    expect(engine.changeOption).toHaveBeenCalledWith('gid-1', {
      'max-download-limit': '500000',
      'max-upload-limit': '100000',
    })

    expect(task.dlLimit).toBe(500_000)
    expect(task.ulLimit).toBe(100_000)
    expect(task.instances[0].payload.dlLimit).toBe(500_000)
    expect(task.instances[0].payload.ulLimit).toBe(100_000)
    expect(persistTask).toHaveBeenCalledWith(
      expect.objectContaining({ dlLimit: 500_000 })
    )
    expect(eventBus.emit).toHaveBeenCalledWith(
      Events.TaskUpdated,
      expect.objectContaining({ id: 'task-1' })
    )
  })

  it('constrains task speed limit by global limit when task limit exceeds global', async () => {
    const handler = createSetTaskSpeedLimitHandler(deps)
    // global is dl: 2_000_000, ul: 500_000
    // task sets dl: 5_000_000, ul: 1_000_000 -> effective is 2_000_000, 500_000
    await handler({
      taskId: 'task-1',
      download: 5_000_000,
      upload: 1_000_000,
    })

    expect(engine.changeOption).toHaveBeenCalledWith('gid-1', {
      'max-download-limit': '2000000',
      'max-upload-limit': '500000',
    })
    // Task stored config retains requested value
    expect(task.dlLimit).toBe(5_000_000)
    expect(task.ulLimit).toBe(1_000_000)
  })

  it('allows 0 to mean unlimited, adopting global limit', async () => {
    const handler = createSetTaskSpeedLimitHandler(deps)
    await handler({
      taskId: 'task-1',
      download: 0,
      upload: 0,
    })

    expect(engine.changeOption).toHaveBeenCalledWith('gid-1', {
      'max-download-limit': '2000000',
      'max-upload-limit': '500000',
    })
    expect(task.dlLimit).toBe(0)
    expect(task.ulLimit).toBe(0)
  })

  it('rejects invalid payload', async () => {
    const handler = createSetTaskSpeedLimitHandler(deps)
    await expect(handler({ taskId: 'task-1', download: -50 })).rejects.toThrow(
      AppError
    )
    await expect(handler({ taskId: '' })).rejects.toThrow(AppError)
  })

  it('rejects when task is not found', async () => {
    const handler = createSetTaskSpeedLimitHandler(deps)
    await expect(
      handler({ taskId: 'unknown-task', download: 100 })
    ).rejects.toThrow(expect.objectContaining({ code: ErrorCode.TaskNotFound }))
  })

  it('rejects when authorizeTaskWrite fails', async () => {
    deps.authorizeTaskWrite = vi
      .fn()
      .mockRejectedValue(new Error('Permission denied'))
    const handler = createSetTaskSpeedLimitHandler(deps)
    await expect(handler({ taskId: 'task-1', download: 100 })).rejects.toThrow(
      'Permission denied'
    )
  })
})
