import { EXTERNAL_URLS } from '../external-urls'
import { redactLogText } from './log-redact'

export interface CrashReportMetadata {
  appName: string
  appVersion: string
  osPlatform: string
  osArch: string
  osRelease?: string
  electronVersion?: string
  chromeVersion?: string
  nodeVersion?: string
  portable?: boolean
}

export interface CrashReportPayload {
  metadata: CrashReportMetadata
  errorName?: string
  errorMessage?: string
  errorStack?: string
  context?: string
  userDescription?: string
  recentLogs?: string[]
}

const REDACTED_USER = '<redacted-user>'

/**
 * Redacts operating system user profile directories from paths.
 * Windows: C:\Users\<username>\ -> C:\Users\<redacted-user>\
 * macOS / Linux: /Users/<username>/ or /home/<username>/ -> /Users/<redacted-user>/
 */
export function redactUserPaths(text: string): string {
  if (!text || typeof text !== 'string') return ''

  return (
    text
      // Windows drive-letter user paths: C:\Users\Username or D:/Users/Username
      .replace(
        /([A-Za-z]:[\\/]Users[\\/])([^\\/\s:;"'<>]+)/gi,
        `$1${REDACTED_USER}`
      )
      // Unix user paths: /home/username or /Users/username (macOS)
      .replace(
        /(^|[\s:;"'(])(\/(?:home|Users)\/)([^\\/\s:;"'<>]+)/g,
        `$1$2${REDACTED_USER}`
      )
  )
}

/**
 * Cleans tokens, credentials, and sensitive parameters from error stacks,
 * messages, and log lines.
 */
export function redactCrashReportText(text: string): string {
  if (!text || typeof text !== 'string') return ''

  let result = redactUserPaths(text)

  // Scrub aria2 RPC secret arguments and headers: --rpc-secret=xxx or "rpc-secret": "xxx"
  result = result
    .replace(/(--rpc-secret[=\s]+)[^\s"']+/gi, '$1[redacted-secret]')
    .replace(
      /(["']?rpc-secret["']?\s*:\s*["'])[^"']+(["'])/gi,
      '$1[redacted-secret]$2'
    )

  // Use shared log text scrubber for URLs, query params, Bearer tokens
  result = redactLogText(result, true)

  return result
}

/**
 * Formats a crash report into a structured Markdown document suitable
 * for GitHub Issue submission.
 */
export function formatCrashReportMarkdown(report: CrashReportPayload): string {
  const { metadata } = report
  const cleanMessage = report.errorMessage
    ? redactCrashReportText(report.errorMessage)
    : ''
  const cleanStack = report.errorStack
    ? redactCrashReportText(report.errorStack)
    : ''
  const title = report.errorName
    ? `${report.errorName}: ${cleanMessage.slice(0, 80)}`
    : 'Unexpected Error / Crash'

  const lines: string[] = []
  lines.push(`### Crash / Error Summary`)
  lines.push(`**${title}**`)
  if (report.context) {
    lines.push(`\n*Context:* ${report.context}`)
  }
  lines.push('')

  lines.push(`### Error Details`)
  lines.push('```')
  if (report.errorName && report.errorMessage) {
    lines.push(`${report.errorName}: ${cleanMessage}`)
  } else if (cleanMessage) {
    lines.push(cleanMessage)
  }
  if (cleanStack) {
    lines.push('')
    lines.push(cleanStack)
  }
  if (!cleanMessage && !cleanStack) {
    lines.push('(No stack trace available)')
  }
  lines.push('```')
  lines.push('')

  lines.push(`### System & Runtime Information`)
  lines.push(`- **App**: ${metadata.appName} v${metadata.appVersion}`)
  lines.push(
    `- **OS**: ${metadata.osPlatform} ${metadata.osArch}${metadata.osRelease ? ` (${metadata.osRelease})` : ''}`
  )
  const runtimes: string[] = []
  if (metadata.electronVersion)
    runtimes.push(`Electron ${metadata.electronVersion}`)
  if (metadata.nodeVersion) runtimes.push(`Node ${metadata.nodeVersion}`)
  if (metadata.chromeVersion) runtimes.push(`Chrome ${metadata.chromeVersion}`)
  if (runtimes.length > 0) {
    lines.push(`- **Runtime**: ${runtimes.join(', ')}`)
  }
  if (metadata.portable !== undefined) {
    lines.push(`- **Portable Mode**: ${metadata.portable ? 'Yes' : 'No'}`)
  }
  lines.push('')

  if (report.recentLogs && report.recentLogs.length > 0) {
    lines.push(`### Diagnostic Logs (Scrubbed)`)
    lines.push('```')
    for (const logLine of report.recentLogs.slice(-30)) {
      lines.push(redactCrashReportText(logLine))
    }
    lines.push('```')
    lines.push('')
  }

  if (report.userDescription) {
    lines.push(`### Description`)
    lines.push(redactCrashReportText(report.userDescription))
    lines.push('')
  }

  lines.push(`### Steps to Reproduce`)
  lines.push('1. ')
  lines.push('2. ')
  lines.push('')

  return lines.join('\n')
}

export interface IssueUrlOptions {
  repoUrl?: string
  maxUrlLength?: number
}

const DEFAULT_MAX_URL_LENGTH = 7000

/**
 * Builds a pre-filled GitHub issue URL from a crash report payload.
 * Truncates body gracefully if the resulting URL would exceed safe browser/HTTP limits.
 */
export function buildGitHubIssueUrl(
  report: CrashReportPayload,
  options: IssueUrlOptions = {}
): string {
  const repoBase = options.repoUrl || EXTERNAL_URLS.github.repository
  const issueBase = `${repoBase.replace(/\/+$/, '')}/issues/new`
  const maxUrlLength = options.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH

  const cleanMessage = report.errorMessage
    ? redactCrashReportText(report.errorMessage)
    : ''
  const issueTitle = report.errorName
    ? `[Crash] ${report.errorName}: ${cleanMessage.slice(0, 60)}`
    : `[Crash] ${report.context || 'Unexpected error'}`

  const markdownBody = formatCrashReportMarkdown(report)

  let url = `${issueBase}?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(markdownBody)}`

  // If URL exceeds maximum length, truncate error stack / logs to fit safely
  if (url.length > maxUrlLength) {
    const truncatedNotice =
      '\n\n*(Diagnostics truncated to fit GitHub URL limit)*'
    let low = 50
    let high = markdownBody.length
    let best = `${markdownBody.slice(0, low)}${truncatedNotice}`
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const candidate = `${markdownBody.slice(0, mid)}${truncatedNotice}`
      const testUrl = `${issueBase}?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(candidate)}`
      if (testUrl.length <= maxUrlLength) {
        best = candidate
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    url = `${issueBase}?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(best)}`
  }

  return url
}
