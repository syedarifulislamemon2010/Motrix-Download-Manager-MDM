import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

export interface SevenZipDetectionResult {
  available: boolean
  binaryPath: string | null
}

const WINDOWS_CANDIDATES = [
  'C:\\Program Files\\7-Zip\\7z.exe',
  'C:\\Program Files (x86)\\7-Zip\\7z.exe',
]

export function detectSevenZipBinary(
  customPath?: string
): SevenZipDetectionResult {
  // 1. User-configured custom binary
  if (customPath && customPath.trim().length > 0) {
    const resolved = path.resolve(customPath)
    if (existsSync(resolved)) {
      return { available: true, binaryPath: resolved }
    }
  }

  // 2. Standard Windows installation paths
  if (process.platform === 'win32') {
    for (const candidate of WINDOWS_CANDIDATES) {
      if (existsSync(candidate)) {
        return { available: true, binaryPath: candidate }
      }
    }
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      const localCandidate = path.join(
        localAppData,
        'Programs',
        '7-Zip',
        '7z.exe'
      )
      if (existsSync(localCandidate)) {
        return { available: true, binaryPath: localCandidate }
      }
    }
  }

  // 3. System PATH check
  try {
    const cmd =
      process.platform === 'win32' ? 'where 7z.exe 7z 7za' : 'which 7z 7za'
    const output = execSync(cmd, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    })
    const firstMatch = output.trim().split(/\r?\n/)[0]?.trim()
    if (firstMatch && existsSync(firstMatch)) {
      return { available: true, binaryPath: firstMatch }
    }
  } catch {
    // Not found on PATH
  }

  return { available: false, binaryPath: null }
}

export class SevenZipDetector {
  constructor(private readonly getCustomPath?: () => string | undefined) {}
  find7z(): string | null {
    return detectSevenZipBinary(this.getCustomPath?.()).binaryPath
  }
}
