import { describe, expect, it } from 'vitest'
import {
  crashErrorPayloadSchema,
  crashReportRequestSchema,
} from './crash-report'

describe('crash-report schemas', () => {
  it('parses error payload', () => {
    const parsed = crashErrorPayloadSchema.parse({
      name: 'TypeError',
      message: 'Failed to fetch',
      stack: 'TypeError: Failed to fetch\n  at test (file.ts:1:1)',
    })
    expect(parsed.name).toBe('TypeError')
    expect(parsed.message).toBe('Failed to fetch')
  })

  it('provides default message if missing in error payload', () => {
    const parsed = crashErrorPayloadSchema.parse({})
    expect(parsed.message).toBe('Unknown error')
  })

  it('parses crash report request', () => {
    const parsed = crashReportRequestSchema.parse({
      error: { message: 'Crash!' },
      context: 'renderer:boundary',
      userDescription: 'Clicked download button',
    })
    expect(parsed?.error?.message).toBe('Crash!')
    expect(parsed?.context).toBe('renderer:boundary')
    expect(parsed?.userDescription).toBe('Clicked download button')
  })

  it('allows undefined / empty request', () => {
    const parsed = crashReportRequestSchema.parse(undefined)
    expect(parsed).toBeUndefined()
  })
})
