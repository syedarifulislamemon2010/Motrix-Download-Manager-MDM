import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import type { AutoExtractSettings } from '@shared/schemas/auto-extract-settings'
import type {
  ArchiveExtractor,
  ArchiveType,
  ExtractOptions,
  ExtractResult,
} from './extract-types'
import { SevenZipExtractor } from './extractors/seven-zip-extractor'
import { ZipExtractor } from './extractors/zip-extractor'
import { toLongPath } from './path-guard'

export interface ArchiveServiceDeps {
  getSettings: () => AutoExtractSettings
}

export class ArchiveService {
  private readonly extractors: ArchiveExtractor[] = []

  constructor(private readonly deps: ArchiveServiceDeps) {
    this.extractors = [
      new ZipExtractor(),
      new SevenZipExtractor(() => this.deps.getSettings().custom7zPath),
    ]
  }

  detectArchiveType(filePath: string): ArchiveType {
    const lower = filePath.toLowerCase()
    if (lower.endsWith('.zip')) return 'zip'
    if (lower.endsWith('.7z')) return 'sevenZip'
    if (lower.endsWith('.rar')) return 'rar'
    return 'unknown'
  }

  isSupportedArchive(filePath: string): boolean {
    const type = this.detectArchiveType(filePath)
    if (type === 'unknown') return false
    const formats = this.deps.getSettings().formats
    if (type === 'zip' && formats.zip) return true
    if (type === 'sevenZip' && formats.sevenZip) return true
    if (type === 'rar' && formats.rar) return true
    return false
  }

  resolveDestination(archivePath: string, options?: ExtractOptions): string {
    if (options?.destinationDir) {
      return path.resolve(options.destinationDir)
    }

    const settings = this.deps.getSettings()
    const dir = path.dirname(archivePath)
    const ext = path.extname(archivePath)
    const baseName = path.basename(archivePath, ext)

    if (settings.mode === 'in_place') {
      return dir
    }

    // Default: 'subfolder'
    return path.join(dir, baseName)
  }

  async extract(
    archivePath: string,
    options?: ExtractOptions
  ): Promise<ExtractResult> {
    const resolvedArchive = path.resolve(archivePath)
    if (!existsSync(resolvedArchive)) {
      return {
        success: false,
        archivePath: resolvedArchive,
        destinationDir: '',
        filesExtracted: 0,
        totalBytes: 0,
        error: `Archive file does not exist: '${resolvedArchive}'`,
      }
    }

    const type = this.detectArchiveType(resolvedArchive)
    const extractor = this.extractors.find((e) => e.canHandle(type))

    if (!extractor) {
      return {
        success: false,
        archivePath: resolvedArchive,
        destinationDir: '',
        filesExtracted: 0,
        totalBytes: 0,
        error: `Unsupported archive type for file: '${resolvedArchive}'`,
      }
    }

    const destDir = this.resolveDestination(resolvedArchive, options)
    const settings = this.deps.getSettings()

    // Passwords to attempt: explicit password first, then passwordList
    const passwordsToTry: Array<string | undefined> = []
    if (options?.password) {
      passwordsToTry.push(options.password)
    } else {
      passwordsToTry.push(undefined)
      if (settings.passwordList && settings.passwordList.length > 0) {
        for (const pwd of settings.passwordList) {
          if (pwd) passwordsToTry.push(pwd)
        }
      }
    }

    let lastResult: ExtractResult = {
      success: false,
      archivePath: resolvedArchive,
      destinationDir: destDir,
      filesExtracted: 0,
      totalBytes: 0,
      error: 'Extraction not attempted',
    }

    for (const password of passwordsToTry) {
      lastResult = await extractor.extract(resolvedArchive, destDir, {
        ...options,
        password,
      })

      if (lastResult.success) break

      // If the error does not look like password required/bad password, stop early
      const errLower = (lastResult.error || '').toLowerCase()
      const isPasswordError =
        errLower.includes('password') ||
        errLower.includes('encrypted') ||
        errLower.includes('wrong password') ||
        errLower.includes('data error')
      if (!isPasswordError) {
        break
      }
    }

    // If successful and deleteArchiveAfterExtract is set: delete the source archive
    const shouldDelete =
      options?.deleteArchiveAfterExtract ?? settings.deleteArchiveAfterExtract
    if (lastResult.success && shouldDelete) {
      try {
        await unlink(toLongPath(resolvedArchive))
      } catch {
        // File deletion failure does not invalidate successful extraction
      }
    }

    return lastResult
  }
}
