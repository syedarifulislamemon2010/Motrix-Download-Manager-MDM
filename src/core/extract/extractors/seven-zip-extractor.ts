import { type ChildProcess, spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  ArchiveExtractor,
  ArchiveType,
  ExtractOptions,
  ExtractResult,
} from '../extract-types'
import { toLongPath } from '../path-guard'
import { detectSevenZipBinary } from './seven-zip-detector'

export class SevenZipExtractor implements ArchiveExtractor {
  constructor(private readonly getCustomPath?: () => string | undefined) {}

  canHandle(type: ArchiveType): boolean {
    return type === 'sevenZip' || type === 'rar'
  }

  async extract(
    archivePath: string,
    destinationDir: string,
    options?: ExtractOptions
  ): Promise<ExtractResult> {
    const customPath = this.getCustomPath?.()
    const detected = detectSevenZipBinary(customPath)

    const safeDest = path.resolve(destinationDir)

    const executablePath = detected.binaryPath
    if (!detected.available || !executablePath) {
      return {
        success: false,
        archivePath,
        destinationDir: safeDest,
        filesExtracted: 0,
        totalBytes: 0,
        error:
          '7-Zip executable not found. Install 7-Zip or configure custom7zPath to extract .7z and .rar archives.',
      }
    }

    await mkdir(toLongPath(safeDest), { recursive: true })

    return new Promise<ExtractResult>((resolve) => {
      const args = [
        'x', // Extract with full paths
        '-y', // Assume yes on all queries
        `-o${safeDest}`, // Output destination
      ]

      if (options?.password) {
        args.push(`-p${options.password}`)
      } else {
        args.push('-p') // Empty password to prevent stdin prompt hanging
      }

      args.push(archivePath)

      let stdout = ''
      let stderr = ''

      const child: ChildProcess = spawn(executablePath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      child.stdout?.on('data', (data: Buffer | string) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data: Buffer | string) => {
        stderr += data.toString()
      })

      child.on('error', (err: Error) => {
        resolve({
          success: false,
          archivePath,
          destinationDir: safeDest,
          filesExtracted: 0,
          totalBytes: 0,
          error: `7z spawn error: ${err.message}`,
        })
      })

      child.on('close', (code: number | null) => {
        if (code === 0) {
          // Parse output for file count if available, e.g. "Files: 5"
          const filesMatch = stdout.match(/Files:\s*(\d+)/i)
          const filesExtracted = filesMatch
            ? Number.parseInt(filesMatch[1], 10)
            : 1

          resolve({
            success: true,
            archivePath,
            destinationDir: safeDest,
            filesExtracted,
            totalBytes: 0,
          })
        } else {
          const errMsg =
            stderr.trim() || stdout.trim() || `7z exited with code ${code}`
          resolve({
            success: false,
            archivePath,
            destinationDir: safeDest,
            filesExtracted: 0,
            totalBytes: 0,
            error: errMsg,
          })
        }
      })
    })
  }
}
