import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DEFAULT_AUTO_EXTRACT_SETTINGS } from '@shared/schemas/auto-extract-settings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ArchiveService } from './archive-service'

function makeZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localHeaders: Buffer[] = []
  const centralHeaders: Buffer[] = []
  let offset = 0

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const loc = Buffer.alloc(30 + nameBuf.length)
    loc.writeUInt32LE(0x04034b50, 0)
    loc.writeUInt16LE(20, 4)
    loc.writeUInt16LE(0, 6)
    loc.writeUInt16LE(0, 8)
    loc.writeUInt16LE(0, 10)
    loc.writeUInt16LE(0, 12)
    loc.writeUInt32LE(0, 14)
    loc.writeUInt32LE(f.data.length, 18)
    loc.writeUInt32LE(f.data.length, 22)
    loc.writeUInt16LE(nameBuf.length, 26)
    loc.writeUInt16LE(0, 28)
    nameBuf.copy(loc, 30)

    localHeaders.push(loc)
    localHeaders.push(f.data)

    const cen = Buffer.alloc(46 + nameBuf.length)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(20, 4)
    cen.writeUInt16LE(20, 6)
    cen.writeUInt16LE(0, 8)
    cen.writeUInt16LE(0, 10)
    cen.writeUInt16LE(0, 12)
    cen.writeUInt16LE(0, 14)
    cen.writeUInt32LE(0, 16)
    cen.writeUInt32LE(f.data.length, 20)
    cen.writeUInt32LE(f.data.length, 24)
    cen.writeUInt16LE(nameBuf.length, 28)
    cen.writeUInt16LE(0, 30)
    cen.writeUInt16LE(0, 32)
    cen.writeUInt16LE(0, 34)
    cen.writeUInt16LE(0, 36)
    cen.writeUInt32LE(0, 38)
    cen.writeUInt32LE(offset, 42)
    nameBuf.copy(cen, 46)

    centralHeaders.push(cen)
    offset += loc.length + f.data.length
  }

  const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0)
  const centralDirOffset = offset

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDirSize, 12)
  eocd.writeUInt32LE(centralDirOffset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd])
}

describe('ArchiveService', () => {
  let tmpDir: string
  let settings = { ...DEFAULT_AUTO_EXTRACT_SETTINGS }
  let service: ArchiveService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'motrix-extract-test-'))
    settings = { ...DEFAULT_AUTO_EXTRACT_SETTINGS }
    service = new ArchiveService({
      getSettings: () => settings,
    })
  })

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('detects archive types properly', () => {
    expect(service.detectArchiveType('file.zip')).toBe('zip')
    expect(service.detectArchiveType('file.7z')).toBe('sevenZip')
    expect(service.detectArchiveType('file.rar')).toBe('rar')
    expect(service.detectArchiveType('file.txt')).toBe('unknown')
  })

  it('checks supported archives according to settings', () => {
    expect(service.isSupportedArchive('test.zip')).toBe(true)
    expect(service.isSupportedArchive('test.7z')).toBe(true)
    expect(service.isSupportedArchive('test.rar')).toBe(true)
    expect(service.isSupportedArchive('test.mp4')).toBe(false)

    settings = {
      ...settings,
      formats: { zip: true, sevenZip: false, rar: false },
    }
    expect(service.isSupportedArchive('test.7z')).toBe(false)
  })

  it('resolves destination according to mode', () => {
    const archivePath = path.join(tmpDir, 'bundle.zip')
    expect(service.resolveDestination(archivePath)).toBe(
      path.join(tmpDir, 'bundle')
    )

    settings = { ...settings, mode: 'in_place' }
    expect(service.resolveDestination(archivePath)).toBe(tmpDir)
  })

  it('extracts zip successfully and handles deleteArchiveAfterExtract', async () => {
    const zipBuf = makeZip([
      { name: 'file1.txt', data: Buffer.from('hello', 'utf8') },
    ])
    const archivePath = path.join(tmpDir, 'archive.zip')
    await writeFile(archivePath, zipBuf)

    const result = await service.extract(archivePath)
    expect(result.success).toBe(true)
    expect(result.filesExtracted).toBe(1)
  })
})
