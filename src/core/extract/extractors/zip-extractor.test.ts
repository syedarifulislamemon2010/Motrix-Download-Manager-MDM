import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeZip } from '../../../test-utils/moext'
import { ZipExtractor } from './zip-extractor'

describe('ZipExtractor', () => {
  let tmpDir: string
  let extractor: ZipExtractor

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `test-zip-extractor-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
    extractor = new ZipExtractor()
  })

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('extracts normal zip archive with nested directories and files', async () => {
    const zipBuf = makeZip([
      { name: 'hello.txt', data: Buffer.from('world', 'utf8') },
      { name: 'sub/', data: Buffer.alloc(0) },
      { name: 'sub/nested.txt', data: Buffer.from('nested content', 'utf8') },
    ])

    const zipPath = path.join(tmpDir, 'archive.zip')
    await writeFile(zipPath, zipBuf)

    const destDir = path.join(tmpDir, 'out')
    const result = await extractor.extract(zipPath, destDir)

    expect(result.success).toBe(true)
    expect(result.filesExtracted).toBe(2)

    const helloContent = await readFile(path.join(destDir, 'hello.txt'), 'utf8')
    expect(helloContent).toBe('world')

    const nestedContent = await readFile(
      path.join(destDir, 'sub', 'nested.txt'),
      'utf8'
    )
    expect(nestedContent).toBe('nested content')
  })

  it('rejects zip slip attempt with .. in filename', async () => {
    const zipBuf = makeZip([
      { name: '../../evil.txt', data: Buffer.from('evil', 'utf8') },
    ])

    const zipPath = path.join(tmpDir, 'evil.zip')
    await writeFile(zipPath, zipBuf)

    const destDir = path.join(tmpDir, 'out')
    const result = await extractor.extract(zipPath, destDir)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(
      /invalid relative path|zip_slip|Directory traversal/i
    )
  })

  it('rejects symlink entries in zip', async () => {
    const zipBuf = makeZip([
      {
        name: 'symlink.txt',
        data: Buffer.from('/etc/passwd', 'utf8'),
        externalAttrUpper16: 0o120777, // symlink mode
      },
    ])

    const zipPath = path.join(tmpDir, 'symlink.zip')
    await writeFile(zipPath, zipBuf)

    const destDir = path.join(tmpDir, 'out')
    const result = await extractor.extract(zipPath, destDir)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Symlink entry')
  })
})
