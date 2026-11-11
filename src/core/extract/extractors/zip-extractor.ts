import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import type {
  ArchiveExtractor,
  ArchiveType,
  ExtractOptions,
  ExtractResult,
} from '../extract-types'
import {
  ArchiveSecurityError,
  toLongPath,
  validateSafeExtractPath,
} from '../path-guard'

const SYMLINK_MODE = 0o120000

export class ZipExtractor implements ArchiveExtractor {
  canHandle(type: ArchiveType): boolean {
    return type === 'zip'
  }

  async extract(
    archivePath: string,
    destinationDir: string,
    _options?: ExtractOptions
  ): Promise<ExtractResult> {
    const safeDest = path.resolve(destinationDir)
    await mkdir(toLongPath(safeDest), { recursive: true })

    return new Promise<ExtractResult>((resolve) => {
      let filesExtracted = 0
      let totalBytes = 0
      const writtenFiles: string[] = []

      yauzl.open(
        archivePath,
        { lazyEntries: true, autoClose: true },
        (err, zipfile) => {
          if (err || !zipfile) {
            resolve({
              success: false,
              archivePath,
              destinationDir: safeDest,
              filesExtracted: 0,
              totalBytes: 0,
              error: err?.message || 'Failed to open ZIP archive',
            })
            return
          }

          const cleanup = async () => {
            for (const file of writtenFiles) {
              try {
                await unlink(toLongPath(file))
              } catch {
                // Ignore cleanup error
              }
            }
          }

          zipfile.on('error', async (error: Error) => {
            await cleanup()
            resolve({
              success: false,
              archivePath,
              destinationDir: safeDest,
              filesExtracted: 0,
              totalBytes: 0,
              error: error.message,
            })
          })

          zipfile.on('end', () => {
            resolve({
              success: true,
              archivePath,
              destinationDir: safeDest,
              filesExtracted,
              totalBytes,
            })
          })

          zipfile.on('entry', async (entry: yauzl.Entry) => {
            try {
              // 1. Check for symlinks
              const mode = (entry.externalFileAttributes >>> 16) & 0o170000
              if (mode === SYMLINK_MODE) {
                throw new ArchiveSecurityError(
                  'archive.symlink_forbidden',
                  `Symlink entry '${entry.fileName}' is forbidden`
                )
              }

              // 2. Validate destination path
              const { absolutePath } = validateSafeExtractPath(
                safeDest,
                entry.fileName
              )

              // 3. Handle directory
              if (entry.fileName.endsWith('/')) {
                await mkdir(toLongPath(absolutePath), { recursive: true })
                zipfile.readEntry()
                return
              }

              // 4. Ensure parent directory exists
              const parentDir = path.dirname(absolutePath)
              await mkdir(toLongPath(parentDir), { recursive: true })

              // 5. Stream file content
              zipfile.openReadStream(entry, async (streamErr, readStream) => {
                if (streamErr || !readStream) {
                  zipfile.emit(
                    'error',
                    streamErr || new Error('Failed to open entry read stream')
                  )
                  return
                }

                try {
                  const writeStream = createWriteStream(
                    toLongPath(absolutePath)
                  )
                  writtenFiles.push(absolutePath)
                  await pipeline(readStream, writeStream)

                  filesExtracted += 1
                  totalBytes += entry.uncompressedSize
                  zipfile.readEntry()
                } catch (writeErr) {
                  zipfile.emit('error', writeErr as Error)
                }
              })
            } catch (entryErr) {
              zipfile.emit('error', entryErr as Error)
            }
          })

          // Start reading entries
          zipfile.readEntry()
        }
      )
    })
  }
}
