import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError, ErrorCode } from '@shared/errors'
import type {
  HelperArch,
  HelperBinaryId,
  HelperBinaryInstallResult,
  HelperBinaryInstallStatus,
  HelperPlatform,
} from '@shared/schemas/helper-binary'
import { HELPER_BINARY_MANIFESTS } from '@shared/schemas/helper-binary'
import * as yauzl from 'yauzl'
import { type BinaryProbeResult, probeBinary } from './binary-probe'

const activeInstalls = new Set<string>()
const statuses = new Map<string, HelperBinaryInstallStatus>()

function statusKey(userDataDir: string, id: HelperBinaryId): string {
  return `${userDataDir}::${id}`
}

export function getHelperBinaryInstallStatus(
  userDataDir: string,
  id: HelperBinaryId
): HelperBinaryInstallStatus {
  const key = statusKey(userDataDir, id)
  const current = statuses.get(key)
  if (current) return { ...current }

  const targetDir = path.resolve(userDataDir, 'binaries', id)
  const receiptPath = path.join(targetDir, 'receipt.json')

  if (existsSync(receiptPath)) {
    try {
      const receipt = JSON.parse(
        // eslint-disable-next-line no-sync
        require('node:fs').readFileSync(receiptPath, 'utf8')
      )
      const binaryPath = path.join(targetDir, receipt.binaryName ?? '')
      if (existsSync(binaryPath)) {
        return {
          id,
          phase: 'installed',
          bytesReceived: 0,
          bytesTotal: 0,
          percent: 100,
          version: receipt.releaseVersion ?? null,
          directory: targetDir,
          error: null,
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    id,
    phase: 'idle',
    bytesReceived: 0,
    bytesTotal: 0,
    percent: null,
    version: null,
    directory: null,
    error: null,
  }
}

export interface InstallHelperBinaryOptions {
  id: HelperBinaryId
  userDataDir: string
  platform?: HelperPlatform
  arch?: HelperArch
  onStatus?: (status: HelperBinaryInstallStatus) => void
  fetcher?: typeof fetch
  probe?: (path: string) => Promise<BinaryProbeResult>
}

export async function installVerifiedHelperBinary(
  options: InstallHelperBinaryOptions
): Promise<HelperBinaryInstallResult> {
  const { id, userDataDir } = options
  const platform = options.platform ?? (process.platform as HelperPlatform)
  const arch = options.arch ?? (process.arch as HelperArch)
  const probe = options.probe ?? probeBinary
  const fetcher = options.fetcher ?? fetch

  const manifest = HELPER_BINARY_MANIFESTS[id]
  if (!manifest) {
    return { ok: false, id, error: 'unknown_binary' }
  }

  const targetSpec = manifest.targets[`${platform}-${arch}`]
  if (!targetSpec) {
    return { ok: false, id, error: 'unsupported_platform' }
  }

  const key = statusKey(userDataDir, id)
  if (activeInstalls.has(key)) {
    throw new AppError(
      ErrorCode.HelperBinaryInstallBusy,
      `Installation for ${id} is already in progress`
    )
  }

  activeInstalls.add(key)
  const targetDir = path.resolve(userDataDir, 'binaries', id)
  const stagingDir = path.join(targetDir, `.tmp-${randomUUID()}`)

  const emit = (status: HelperBinaryInstallStatus) => {
    statuses.set(key, status)
    options.onStatus?.(status)
  }

  emit({
    id,
    phase: 'downloading',
    bytesReceived: 0,
    bytesTotal: 0,
    percent: null,
    version: null,
    directory: targetDir,
    error: null,
  })

  try {
    await mkdir(stagingDir, { recursive: true })

    const res = await fetcher(targetSpec.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Motrix-Verified-Downloader',
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP download failed with status ${res.status}`)
    }

    const contentLength = Number(res.headers.get('content-length')) || 0
    let bytesReceived = 0
    const hasher = createHash('sha256')
    const chunks: Buffer[] = []

    if (!res.body) {
      throw new Error('Response body is null')
    }

    const reader = res.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        const chunk = Buffer.from(value)
        hasher.update(chunk)
        chunks.push(chunk)
        bytesReceived += chunk.length
        const percent =
          contentLength > 0
            ? Math.min(100, Math.round((bytesReceived / contentLength) * 100))
            : null

        emit({
          id,
          phase: 'downloading',
          bytesReceived,
          bytesTotal: contentLength,
          percent,
          version: null,
          directory: targetDir,
          error: null,
        })
      }
    }

    emit({
      id,
      phase: 'verifying',
      bytesReceived,
      bytesTotal: contentLength,
      percent: 100,
      version: null,
      directory: targetDir,
      error: null,
    })

    const computedHash = hasher.digest('hex').toLowerCase()
    if (computedHash !== targetSpec.sha256.toLowerCase()) {
      throw new AppError(
        ErrorCode.HelperBinaryInstallFailed,
        `Checksum mismatch for ${id}. Expected ${targetSpec.sha256}, got ${computedHash}`
      )
    }

    const buffer = Buffer.concat(chunks)
    const stagedBinaryPath = path.join(stagingDir, targetSpec.binaryName)

    if (targetSpec.isArchive) {
      emit({
        id,
        phase: 'extracting',
        bytesReceived,
        bytesTotal: contentLength,
        percent: 100,
        version: null,
        directory: targetDir,
        error: null,
      })

      await new Promise<void>((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
          if (err || !zipfile) {
            reject(err ?? new Error('Failed to open archive buffer'))
            return
          }

          let binaryExtracted = false
          zipfile.readEntry()

          zipfile.on('entry', (entry: yauzl.Entry) => {
            const entryBase = path.basename(entry.fileName)
            if (entryBase === targetSpec.binaryName) {
              binaryExtracted = true
              zipfile.openReadStream(entry, (streamErr, readStream) => {
                if (streamErr || !readStream) {
                  reject(streamErr ?? new Error('Failed to read entry stream'))
                  return
                }

                const entryChunks: Buffer[] = []
                readStream.on('data', (c: Buffer) => entryChunks.push(c))
                readStream.on('end', () => {
                  writeFile(stagedBinaryPath, Buffer.concat(entryChunks))
                    .then(() => {
                      zipfile.close()
                      resolve()
                    })
                    .catch(reject)
                })
                readStream.on('error', reject)
              })
            } else {
              zipfile.readEntry()
            }
          })

          zipfile.on('end', () => {
            if (!binaryExtracted) {
              reject(
                new Error(
                  `Binary ${targetSpec.binaryName} not found in archive`
                )
              )
            }
          })
          zipfile.on('error', reject)
        })
      })
    } else {
      await writeFile(stagedBinaryPath, buffer)
    }

    if (platform !== 'win32') {
      await chmod(stagedBinaryPath, 0o755)
    }

    // Probe to ensure the binary runs
    const probeRes = await probe(stagedBinaryPath)
    if (!probeRes.available) {
      throw new AppError(
        ErrorCode.HelperBinaryInstallFailed,
        `Binary execution check failed for ${id} at ${stagedBinaryPath}`
      )
    }

    // Move to final destination
    await mkdir(targetDir, { recursive: true })
    const finalBinaryPath = path.join(targetDir, targetSpec.binaryName)
    try {
      await rm(finalBinaryPath, { force: true })
    } catch {
      // ignore
    }
    await rename(stagedBinaryPath, finalBinaryPath)

    const receipt = {
      releaseVersion: manifest.releaseVersion,
      sha256: targetSpec.sha256,
      binaryName: targetSpec.binaryName,
      platform,
      arch,
      installedAt: Date.now(),
    }
    await writeFile(
      path.join(targetDir, 'receipt.json'),
      JSON.stringify(receipt, null, 2),
      'utf8'
    )

    // Cleanup staging directory
    try {
      await rm(stagingDir, { recursive: true, force: true })
    } catch {
      // ignore
    }

    const installedVersion = probeRes.version || manifest.releaseVersion
    const finalStatus: HelperBinaryInstallStatus = {
      id,
      phase: 'installed',
      bytesReceived,
      bytesTotal: contentLength,
      percent: 100,
      version: installedVersion,
      directory: targetDir,
      error: null,
    }
    emit(finalStatus)

    return {
      ok: true,
      id,
      version: installedVersion,
    }
  } catch (error) {
    try {
      await rm(stagingDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
    const errMessage = error instanceof Error ? error.message : String(error)
    const errStatus: HelperBinaryInstallStatus = {
      id,
      phase: 'error',
      bytesReceived: 0,
      bytesTotal: 0,
      percent: null,
      version: null,
      directory: targetDir,
      error: errMessage,
    }
    emit(errStatus)
    return {
      ok: false,
      id,
      error: errMessage,
    }
  } finally {
    activeInstalls.delete(key)
  }
}
