import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Events } from '@shared/protocol/events'
import { DEFAULT_AUTO_EXTRACT_SETTINGS } from '@shared/schemas/auto-extract-settings'
import { type DownloadTask, TaskStatus } from '@shared/types/task'
import type { TaskOccurrence } from '@shared/types/task-occurrence'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveService } from './archive-service'
import { createAutoExtractOccurrenceConsumer } from './auto-extract-consumer'

function makeMinimalZip(): Buffer {
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  return Buffer.concat([local, eocd])
}

describe('AutoExtractOccurrenceConsumer', () => {
  let tmpDir: string
  let settings = {
    ...DEFAULT_AUTO_EXTRACT_SETTINGS,
    enabled: true,
    mode: 'subfolder' as const,
  }
  const emittedEvents: Array<{ channel: string; payload: unknown }> = []
  const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'motrix-consumer-test-'))
    emittedEvents.length = 0
    settings = {
      ...DEFAULT_AUTO_EXTRACT_SETTINGS,
      enabled: true,
      mode: 'subfolder' as const,
    }
  })

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('ignores non-terminal or non-completed occurrences', async () => {
    const archiveService = new ArchiveService({ getSettings: () => settings })
    const extractSpy = vi.spyOn(archiveService, 'extract')

    const consumer = createAutoExtractOccurrenceConsumer({
      archiveService,
      getSettings: () => settings,
      getTask: () => undefined,
      eventBus: {
        emit: (c, p) => emittedEvents.push({ channel: c, payload: p }),
      },
      log: mockLog,
    })

    const occ: TaskOccurrence = {
      occurrenceId: 'occ-1',
      taskId: 'task-1',
      type: 'diagnosis',
      terminalOccurrenceId: 'term-1',
      revision: 1,
      diagnosis: {} as never,
      createdAt: Date.now(),
    }

    await consumer.consume(occ)
    expect(extractSpy).not.toHaveBeenCalled()
  })

  it('extracts when task completes and is a supported archive', async () => {
    const zipPath = path.join(tmpDir, 'downloaded.zip')
    await writeFile(zipPath, makeMinimalZip())

    const task: DownloadTask = {
      id: 'task-1',
      gid: 'gid-1',
      name: 'downloaded.zip',
      saveDir: tmpDir,
      finalPath: zipPath,
      status: TaskStatus.Completed,
    } as unknown as DownloadTask

    const archiveService = new ArchiveService({ getSettings: () => settings })
    const extractSpy = vi.spyOn(archiveService, 'extract').mockResolvedValue({
      success: true,
      archivePath: zipPath,
      destinationDir: path.join(tmpDir, 'downloaded'),
      filesExtracted: 1,
      totalBytes: 100,
    })

    const consumer = createAutoExtractOccurrenceConsumer({
      archiveService,
      getSettings: () => settings,
      getTask: () => task,
      eventBus: {
        emit: (c, p) => emittedEvents.push({ channel: c, payload: p }),
      },
      log: mockLog,
    })

    const occ: TaskOccurrence = {
      occurrenceId: 'occ-2',
      taskId: 'task-1',
      type: 'terminal',
      fromStatus: TaskStatus.Downloading,
      toStatus: TaskStatus.Completed,
      cause: 'engine',
      errorGroup: null,
      createdAt: Date.now(),
    }

    await consumer.consume(occ)
    expect(extractSpy).toHaveBeenCalledWith(zipPath)
    expect(
      emittedEvents.some((e) => e.channel === Events.ArchiveExtracted)
    ).toBe(true)
  })
})
