import { describe, expect, it } from 'vitest'
import { setTaskSpeedLimitSchema } from './task-speed-limit'

describe('setTaskSpeedLimitSchema', () => {
  it('accepts valid taskId and speed limits', () => {
    const valid = setTaskSpeedLimitSchema.parse({
      taskId: 'task-123',
      download: 1024 * 1024,
      upload: 512 * 1024,
    })
    expect(valid).toEqual({
      taskId: 'task-123',
      download: 1048576,
      upload: 524288,
    })
  })

  it('allows 0 as unlimited for limits', () => {
    const parsed = setTaskSpeedLimitSchema.parse({
      taskId: 'task-1',
      download: 0,
      upload: 0,
    })
    expect(parsed.download).toBe(0)
    expect(parsed.upload).toBe(0)
  })

  it('allows optional download and upload', () => {
    const parsed = setTaskSpeedLimitSchema.parse({
      taskId: 'task-1',
    })
    expect(parsed.taskId).toBe('task-1')
    expect(parsed.download).toBeUndefined()
    expect(parsed.upload).toBeUndefined()
  })

  it('rejects negative limits', () => {
    expect(() =>
      setTaskSpeedLimitSchema.parse({
        taskId: 'task-1',
        download: -100,
      })
    ).toThrow()
  })

  it('rejects empty taskId', () => {
    expect(() =>
      setTaskSpeedLimitSchema.parse({
        taskId: '',
        download: 100,
      })
    ).toThrow()
  })
})
