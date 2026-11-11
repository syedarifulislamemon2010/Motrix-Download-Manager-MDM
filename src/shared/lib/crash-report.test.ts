import { describe, expect, it } from 'vitest'
import {
  buildGitHubIssueUrl,
  type CrashReportPayload,
  formatCrashReportMarkdown,
  redactCrashReportText,
  redactUserPaths,
} from './crash-report'

describe('crash-report', () => {
  describe('redactUserPaths', () => {
    it('redacts Windows C:\\Users\\<name> paths', () => {
      const input =
        'Error at C:\\Users\\Administrator\\AppData\\Roaming\\Motrix\\test.js:10:5'
      const redacted = redactUserPaths(input)
      expect(redacted).toBe(
        'Error at C:\\Users\\<redacted-user>\\AppData\\Roaming\\Motrix\\test.js:10:5'
      )
    })

    it('redacts Windows forward-slash D:/Users/<name> paths', () => {
      const input = 'File at D:/Users/SyedEmon/Projects/motrix/file.ts'
      const redacted = redactUserPaths(input)
      expect(redacted).toBe(
        'File at D:/Users/<redacted-user>/Projects/motrix/file.ts'
      )
    })

    it('redacts Unix /home/<name> paths', () => {
      const input = 'Failed to load /home/ubuntu/.config/Motrix/settings.json'
      const redacted = redactUserPaths(input)
      expect(redacted).toBe(
        'Failed to load /home/<redacted-user>/.config/Motrix/settings.json'
      )
    })

    it('redacts macOS /Users/<name> paths', () => {
      const input =
        'Stack: /Users/john/Library/Application Support/Motrix/app.log'
      const redacted = redactUserPaths(input)
      expect(redacted).toBe(
        'Stack: /Users/<redacted-user>/Library/Application Support/Motrix/app.log'
      )
    })
  })

  describe('redactCrashReportText', () => {
    it('redacts credentials, URLs with query tokens, and user paths together', () => {
      const stack = [
        'Error: fetch failed',
        '    at C:\\Users\\Alice\\dev\\src\\index.ts:42',
        '    url: https://secret.example.com/api?token=SUPER_SECRET_123&user=alice',
        '    args: --rpc-secret=MY_ARIA2_PASSWORD',
        '    auth: Bearer my-jwt-token-xyz',
      ].join('\n')

      const redacted = redactCrashReportText(stack)

      expect(redacted).not.toContain('Alice')
      expect(redacted).toContain('C:\\Users\\<redacted-user>')
      expect(redacted).not.toContain('SUPER_SECRET_123')
      expect(redacted).toContain('token=[redacted]')
      expect(redacted).not.toContain('MY_ARIA2_PASSWORD')
      expect(redacted).toContain('--rpc-secret=[redacted-secret]')
      expect(redacted).not.toContain('my-jwt-token-xyz')
      expect(redacted).toContain('Bearer [redacted]')
    })
  })

  describe('formatCrashReportMarkdown and buildGitHubIssueUrl', () => {
    const samplePayload: CrashReportPayload = {
      metadata: {
        appName: 'Motrix Turbo',
        appVersion: '2.4.1',
        osPlatform: 'win32',
        osArch: 'x64',
        osRelease: '10.0.19045',
        electronVersion: '45.0.0',
        nodeVersion: '24.0.0',
        chromeVersion: '130.0.0',
        portable: false,
      },
      errorName: 'TypeError',
      errorMessage:
        'Cannot read properties of undefined at C:\\Users\\Bob\\app.js',
      errorStack:
        'TypeError: Cannot read properties of undefined\n    at C:\\Users\\Bob\\app.js:15:3',
      context: 'bootstrap:initialize',
      recentLogs: [
        'level=info msg="Starting engine"',
        'level=error msg="Crash detected at C:\\Users\\Bob\\app.js"',
      ],
    }

    it('formats markdown with redacted paths and metadata', () => {
      const md = formatCrashReportMarkdown(samplePayload)

      expect(md).toContain('### Crash / Error Summary')
      expect(md).toContain('TypeError')
      expect(md).not.toContain('Bob')
      expect(md).toContain('<redacted-user>')
      expect(md).toContain('- **App**: Motrix Turbo v2.4.1')
      expect(md).toContain('- **OS**: win32 x64 (10.0.19045)')
      expect(md).toContain('Electron 45.0.0')
      expect(md).toContain('### Diagnostic Logs (Scrubbed)')
    })

    it('builds a valid pre-filled GitHub issue URL', () => {
      const url = buildGitHubIssueUrl(samplePayload)

      expect(url).toContain('https://github.com/agalwood/Motrix/issues/new?')
      expect(url).toContain('title=')
      expect(url).toContain('body=')
      expect(url).not.toContain('Bob')

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('title')).toContain('[Crash] TypeError')
      expect(parsedUrl.searchParams.get('body')).toContain('Motrix Turbo')
    })

    it('gracefully truncates oversized markdown bodies', () => {
      const hugePayload: CrashReportPayload = {
        ...samplePayload,
        errorMessage: 'Huge error'.repeat(1000),
        errorStack: 'Huge stack trace line\n'.repeat(500),
      }

      const url = buildGitHubIssueUrl(hugePayload, { maxUrlLength: 3000 })
      expect(url.length).toBeLessThanOrEqual(3000)
      expect(url).toContain('truncated')
    })
  })
})
