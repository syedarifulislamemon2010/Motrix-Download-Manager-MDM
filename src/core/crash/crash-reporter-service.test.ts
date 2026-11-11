import { beforeEach, describe, expect, it } from 'vitest'
import { CrashReporterService } from './crash-reporter-service'

describe('CrashReporterService', () => {
  let service: CrashReporterService

  beforeEach(() => {
    service = new CrashReporterService({
      appName: 'Motrix Test',
      appVersion: '2.4.1',
      isPortable: true,
      maxLogs: 5,
    })
  })

  it('collects system metadata correctly', () => {
    const meta = service.getSystemMetadata()
    expect(meta.appName).toBe('Motrix Test')
    expect(meta.appVersion).toBe('2.4.1')
    expect(meta.portable).toBe(true)
    expect(typeof meta.osPlatform).toBe('string')
    expect(typeof meta.osArch).toBe('string')
  })

  it('records errors and logs in a bounded ring buffer', () => {
    service.addLogEntry('log 1')
    service.addLogEntry('log 2')
    service.addLogEntry('log 3')
    service.addLogEntry('log 4')
    service.addLogEntry('log 5')
    service.addLogEntry('log 6')

    const logs = service.getRecentLogs()
    expect(logs.length).toBe(5)
    expect(logs).not.toContain('log 1')
    expect(logs).toContain('log 6')
  })

  it('records error with context and creates a pre-filled issue URL', () => {
    const error = new Error(
      'Database connection failed at C:\\Users\\Dev\\db.ts:20'
    )
    service.recordError(error, 'session:restore')

    const report = service.buildReport()
    expect(report.errorName).toBe('Error')
    expect(report.errorMessage).toContain('Database connection failed')
    expect(report.context).toBe('session:restore')

    const url = service.getGitHubIssueUrl()
    expect(url).toContain('https://github.com/agalwood/Motrix/issues/new?')
    expect(url).toContain('%5BCrash%5D')
    expect(url).not.toContain('Dev')
    expect(decodeURIComponent(url)).toContain('<redacted-user>')
  })
})
