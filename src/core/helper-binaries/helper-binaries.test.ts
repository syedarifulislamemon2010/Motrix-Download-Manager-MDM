import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { HELPER_BINARY_MANIFESTS } from '@shared/schemas/helper-binary'
import { describe, expect, it, vi } from 'vitest'
import { locateHelperBinary } from './binary-locator'
import { probeBinary } from './binary-probe'
import {
  getHelperBinaryInstallStatus,
  installVerifiedHelperBinary,
} from './verified-installer'

function makeMockZip(entryName: string, content: Buffer): Buffer {
  const local = Buffer.alloc(30 + entryName.length + content.length)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0, 6) // flags
  local.writeUInt16LE(0, 8) // method = stored
  local.writeUInt16LE(0, 10) // mod time
  local.writeUInt16LE(0, 12) // mod date
  const crc = 0
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(content.length, 18) // comp size
  local.writeUInt32LE(content.length, 22) // uncomp size
  local.writeUInt16LE(entryName.length, 26)
  local.writeUInt16LE(0, 28) // extra len
  local.write(entryName, 30)
  content.copy(local, 30 + entryName.length)

  const central = Buffer.alloc(46 + entryName.length)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0, 8)
  central.writeUInt16LE(0, 10)
  central.writeUInt16LE(0, 12)
  central.writeUInt16LE(0, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(content.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(entryName.length, 28)
  central.writeUInt16LE(0, 30)
  central.writeUInt16LE(0, 32)
  central.writeUInt16LE(0, 34)
  central.writeUInt16LE(0, 36)
  central.writeUInt32LE(0, 38)
  central.writeUInt32LE(0, 42) // offset
  central.write(entryName, 46)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(1, 8) // total entries this disk
  eocd.writeUInt16LE(1, 10) // total entries
  eocd.writeUInt32LE(central.length, 12)
  eocd.writeUInt32LE(local.length, 16) // offset of central dir
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([local, central, eocd])
}

describe('binary-probe', () => {
  it('returns unavailable for non-existent path', async () => {
    const res = await probeBinary('/non/existent/path/tool.exe')
    expect(res.available).toBe(false)
  })
})

describe('binary-locator', () => {
  it('detects unconfigured and missing candidates when none exist', async () => {
    const res = await locateHelperBinary(
      'yt-dlp',
      {
        userDataDir: '/tmp/test-motrix',
        platform: 'win32',
      },
      async () => ({ available: false })
    )

    expect(res.id).toBe('yt-dlp')
    expect(res.active).toBeNull()
    expect(res.candidates).toHaveLength(4)
    expect(res.candidates[0].kind).toBe('manual')
    expect(res.candidates[0].state).toBe('unconfigured')
  })

  it('selects manual path as active winner when probe succeeds', async () => {
    const mockProbe = vi.fn().mockImplementation(async (p: string) => {
      if (p === 'D:\\bin\\yt-dlp.exe') {
        return { available: true, binaryPath: p, version: '2025.02.19' }
      }
      return { available: false }
    })

    const res = await locateHelperBinary(
      'yt-dlp',
      {
        manualPath: 'D:\\bin\\yt-dlp.exe',
        userDataDir: '/tmp/test-motrix',
        platform: 'win32',
      },
      mockProbe
    )

    expect(res.active).toEqual({
      path: 'D:\\bin\\yt-dlp.exe',
      version: '2025.02.19',
    })
    expect(res.candidates[0].state).toBe('active')
  })

  it('falls back to userData candidate if manual is unconfigured', async () => {
    const mockProbe = vi.fn().mockImplementation(async (p: string) => {
      if (p.includes('binaries') && p.includes('gallery-dl')) {
        return { available: true, binaryPath: p, version: '1.28.5' }
      }
      return { available: false }
    })

    const res = await locateHelperBinary(
      'gallery-dl',
      {
        userDataDir: 'C:\\Users\\test\\AppData\\Roaming\\Motrix',
        platform: 'win32',
      },
      mockProbe
    )

    expect(res.active).not.toBeNull()
    expect(res.active?.version).toBe('1.28.5')
    expect(res.candidates[1].state).toBe('active')
  })
})

describe('verified-installer', () => {
  it('installs verified standalone binary and tracks progress', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'motrix-helper-bin-'))
    const originalSha =
      HELPER_BINARY_MANIFESTS['yt-dlp'].targets['win32-x64']!.sha256
    try {
      const mockContent = Buffer.from('mock yt-dlp executable binary content')
      HELPER_BINARY_MANIFESTS['yt-dlp'].targets['win32-x64']!.sha256 =
        createHash('sha256').update(mockContent).digest('hex')

      // Mock fetcher that streams mockContent
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': String(mockContent.length),
        }),
        body: {
          getReader() {
            let done = false
            return {
              async read() {
                if (done) return { done: true, value: undefined }
                done = true
                return { done: false, value: new Uint8Array(mockContent) }
              },
            }
          },
        },
      })

      const mockProbe = vi.fn().mockResolvedValue({
        available: true,
        version: '2025.02.19',
      })

      const statuses: string[] = []
      const res = await installVerifiedHelperBinary({
        id: 'yt-dlp',
        userDataDir: tmpDir,
        platform: 'win32',
        arch: 'x64',
        fetcher: mockFetcher as unknown as typeof fetch,
        probe: mockProbe,
        onStatus: (s) => statuses.push(s.phase),
      })

      expect(res.ok).toBe(true)
      expect(res.version).toBe('2025.02.19')
      expect(statuses).toContain('downloading')
      expect(statuses).toContain('verifying')
      expect(statuses).toContain('installed')

      const status = getHelperBinaryInstallStatus(tmpDir, 'yt-dlp')
      expect(status.phase).toBe('installed')
      expect(status.version).toBe('2025.02.19')
    } finally {
      HELPER_BINARY_MANIFESTS['yt-dlp'].targets['win32-x64']!.sha256 =
        originalSha
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails with checksum mismatch if downloaded hash differs', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'motrix-helper-bin-'))
    try {
      const corruptContent = Buffer.from('corrupt content')
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': String(corruptContent.length),
        }),
        body: {
          getReader() {
            let done = false
            return {
              async read() {
                if (done) return { done: true, value: undefined }
                done = true
                return { done: false, value: new Uint8Array(corruptContent) }
              },
            }
          },
        },
      })

      const res = await installVerifiedHelperBinary({
        id: 'yt-dlp',
        userDataDir: tmpDir,
        platform: 'win32',
        arch: 'x64',
        fetcher: mockFetcher as unknown as typeof fetch,
      })

      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/Checksum mismatch/)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('extracts archived binary (deno) from zip', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'motrix-helper-bin-'))
    const originalSha =
      HELPER_BINARY_MANIFESTS.deno.targets['win32-x64']!.sha256
    try {
      const mockDenoBin = Buffer.from('deno exe payload')
      const zipBuffer = makeMockZip('deno.exe', mockDenoBin)
      HELPER_BINARY_MANIFESTS.deno.targets['win32-x64']!.sha256 = createHash(
        'sha256'
      )
        .update(zipBuffer)
        .digest('hex')

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': String(zipBuffer.length),
        }),
        body: {
          getReader() {
            let done = false
            return {
              async read() {
                if (done) return { done: true, value: undefined }
                done = true
                return { done: false, value: new Uint8Array(zipBuffer) }
              },
            }
          },
        },
      })

      const mockProbe = vi.fn().mockResolvedValue({
        available: true,
        version: 'v2.2.0',
      })

      const statuses: string[] = []
      const res = await installVerifiedHelperBinary({
        id: 'deno',
        userDataDir: tmpDir,
        platform: 'win32',
        arch: 'x64',
        fetcher: mockFetcher as unknown as typeof fetch,
        probe: mockProbe,
        onStatus: (s) => statuses.push(s.phase),
      })

      expect(res.ok).toBe(true)
      expect(res.version).toBe('v2.2.0')
      expect(statuses).toContain('extracting')
      expect(statuses).toContain('installed')
    } finally {
      HELPER_BINARY_MANIFESTS.deno.targets['win32-x64']!.sha256 = originalSha
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
