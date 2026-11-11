import os from 'node:os'
import {
  buildGitHubIssueUrl,
  type CrashReportMetadata,
  type CrashReportPayload,
  formatCrashReportMarkdown,
  redactCrashReportText,
} from '@shared/lib/crash-report'

export interface CrashReporterDeps {
  appName: string
  appVersion: string
  isPortable?: boolean
  maxLogs?: number
}

export class CrashReporterService {
  private readonly recentLogs: string[] = []
  private readonly maxLogs: number
  private lastError: {
    name?: string
    message?: string
    stack?: string
    context?: string
  } | null = null

  constructor(private readonly deps: CrashReporterDeps) {
    this.maxLogs = deps.maxLogs ?? 50
  }

  recordError(error: unknown, context?: string): void {
    if (error instanceof Error) {
      this.lastError = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        context,
      }
      this.addLogEntry(
        `[${context || 'error'}] ${error.name}: ${error.message}`
      )
    } else if (typeof error === 'string') {
      this.lastError = {
        name: 'Error',
        message: error,
        context,
      }
      this.addLogEntry(`[${context || 'error'}] ${error}`)
    } else if (error && typeof error === 'object') {
      const errObj = error as {
        name?: string
        message?: string
        stack?: string
      }
      this.lastError = {
        name: errObj.name || 'Error',
        message: errObj.message || 'Unknown error object',
        stack: errObj.stack,
        context,
      }
      this.addLogEntry(
        `[${context || 'error'}] ${errObj.name || 'Error'}: ${errObj.message || ''}`
      )
    }
  }

  addLogEntry(entry: string): void {
    if (!entry) return
    const scrubbed = redactCrashReportText(entry)
    this.recentLogs.push(scrubbed)
    if (this.recentLogs.length > this.maxLogs) {
      this.recentLogs.shift()
    }
  }

  getRecentLogs(): string[] {
    return [...this.recentLogs]
  }

  getLastError() {
    return this.lastError
  }

  getSystemMetadata(): CrashReportMetadata {
    const electronVersion =
      typeof process !== 'undefined' && process.versions
        ? (process.versions as Record<string, string>).electron
        : undefined
    const chromeVersion =
      typeof process !== 'undefined' && process.versions
        ? (process.versions as Record<string, string>).chrome
        : undefined
    const nodeVersion =
      typeof process !== 'undefined' && process.versions
        ? process.versions.node
        : undefined

    return {
      appName: this.deps.appName,
      appVersion: this.deps.appVersion,
      osPlatform: os.platform(),
      osArch: os.arch(),
      osRelease: os.release(),
      electronVersion,
      chromeVersion,
      nodeVersion,
      portable: this.deps.isPortable,
    }
  }

  buildReport(
    error?: unknown,
    context?: string,
    userDescription?: string
  ): CrashReportPayload {
    const metadata = this.getSystemMetadata()

    let errorName: string | undefined
    let errorMessage: string | undefined
    let errorStack: string | undefined
    let errorContext = context

    if (error) {
      if (error instanceof Error) {
        errorName = error.name
        errorMessage = error.message
        errorStack = error.stack
      } else if (typeof error === 'string') {
        errorName = 'Error'
        errorMessage = error
      } else if (typeof error === 'object') {
        const errObj = error as {
          name?: string
          message?: string
          stack?: string
        }
        errorName = errObj.name
        errorMessage = errObj.message
        errorStack = errObj.stack
      }
    } else if (this.lastError) {
      errorName = this.lastError.name
      errorMessage = this.lastError.message
      errorStack = this.lastError.stack
      errorContext ??= this.lastError.context
    }

    return {
      metadata,
      errorName,
      errorMessage,
      errorStack,
      context: errorContext,
      userDescription,
      recentLogs: this.getRecentLogs(),
    }
  }

  getGitHubIssueUrl(
    error?: unknown,
    context?: string,
    userDescription?: string
  ): string {
    const report = this.buildReport(error, context, userDescription)
    return buildGitHubIssueUrl(report)
  }

  formatMarkdown(
    error?: unknown,
    context?: string,
    userDescription?: string
  ): string {
    const report = this.buildReport(error, context, userDescription)
    return formatCrashReportMarkdown(report)
  }
}
