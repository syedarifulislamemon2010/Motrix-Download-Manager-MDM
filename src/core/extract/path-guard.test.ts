import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ArchiveSecurityError,
  hasDriveLetter,
  isWindowsReservedName,
  sanitizeSegment,
  toLongPath,
  validateSafeExtractPath,
} from './path-guard'

describe('path-guard', () => {
  describe('toLongPath', () => {
    it('returns original path on non-win32 or adds \\\\?\\ on win32', () => {
      const p = 'C:\\Downloads\\archive\\file.txt'
      const long = toLongPath(p)
      if (process.platform === 'win32') {
        expect(long.startsWith('\\\\?\\')).toBe(true)
      } else {
        expect(long).toBe(p)
      }
    })

    it('does not double prefix paths already prefixed', () => {
      const p = '\\\\?\\C:\\Downloads'
      expect(toLongPath(p)).toBe(p)
    })
  })

  describe('isWindowsReservedName', () => {
    it.each([
      ['CON', true],
      ['con', true],
      ['PRN', true],
      ['AUX', true],
      ['NUL', true],
      ['COM1', true],
      ['COM9', true],
      ['LPT1', true],
      ['LPT5', true],
      ['con.txt', true],
      ['nul.dat', true],
      ['normal.txt', false],
      ['content.doc', false],
      ['con_file.txt', false],
    ])('identifies %s as reserved = %s', (name, expected) => {
      expect(isWindowsReservedName(name)).toBe(expected)
    })
  })

  describe('hasDriveLetter', () => {
    it.each([
      ['C:foo', true],
      ['D:\\bar', true],
      ['c:/temp', true],
      ['foo/bar', false],
      ['/etc/passwd', false],
    ])('checks drive letter for %s: %s', (p, expected) => {
      expect(hasDriveLetter(p)).toBe(expected)
    })
  })

  describe('sanitizeSegment', () => {
    it('strips trailing dots and spaces', () => {
      expect(sanitizeSegment('myfile...')).toBe('myfile')
      expect(sanitizeSegment('myfolder   ')).toBe('myfolder')
      expect(sanitizeSegment('test. .')).toBe('test')
    })

    it('prefixes reserved device names with an underscore', () => {
      expect(sanitizeSegment('CON')).toBe('_CON')
      expect(sanitizeSegment('nul.txt')).toBe('_nul.txt')
      expect(sanitizeSegment('aux')).toBe('_aux')
    })
  })

  describe('validateSafeExtractPath', () => {
    const destDir = path.resolve('/tmp/dest')

    it('accepts safe relative path', () => {
      const result = validateSafeExtractPath(
        destDir,
        'folder/subfolder/file.txt'
      )
      expect(result.absolutePath.startsWith(destDir)).toBe(true)
    })

    it('rejects path traversal with ..', () => {
      expect(() =>
        validateSafeExtractPath(destDir, '../../etc/passwd')
      ).toThrow(ArchiveSecurityError)

      expect(() =>
        validateSafeExtractPath(destDir, 'sub/../../windows/system32')
      ).toThrow(ArchiveSecurityError)
    })

    it('rejects absolute paths', () => {
      expect(() =>
        validateSafeExtractPath(destDir, '/absolute/path/file.txt')
      ).toThrow(ArchiveSecurityError)
    })

    it('rejects drive letter paths', () => {
      expect(() =>
        validateSafeExtractPath(destDir, 'C:\\Windows\\system32\\cmd.exe')
      ).toThrow(ArchiveSecurityError)

      expect(() => validateSafeExtractPath(destDir, 'C:malicious.exe')).toThrow(
        ArchiveSecurityError
      )
    })

    it('sanitizes reserved names inside paths without escaping destination', () => {
      const result = validateSafeExtractPath(destDir, 'docs/con/readme.txt')
      expect(result.absolutePath.startsWith(destDir)).toBe(true)
      expect(result.safeRelativePath).toContain('_con')
    })
  })
})
