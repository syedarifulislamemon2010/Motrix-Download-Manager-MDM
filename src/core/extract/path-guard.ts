import path from 'node:path'

const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i

export class ArchiveSecurityError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ArchiveSecurityError'
  }
}

/** Prefix path with Win32 extended-length path format if running on Windows. */
export function toLongPath(p: string): string {
  if (process.platform !== 'win32') return p
  if (p.startsWith('\\\\?\\') || p.startsWith('\\\\.\\')) return p
  const resolved = path.resolve(p)
  if (resolved.startsWith('\\\\')) {
    // UNC path: \\server\share -> \\?\UNC\server\share
    return `\\\\?\\UNC\\${resolved.slice(2)}`
  }
  return `\\\\?\\${resolved}`
}

/** Check if a filename or folder segment is a Windows reserved device name. */
export function isWindowsReservedName(segment: string): boolean {
  return WINDOWS_RESERVED_NAMES.test(segment.trim())
}

/** Check if an entry or segment contains a drive letter (e.g. C:). */
export function hasDriveLetter(segment: string): boolean {
  return /^[a-zA-Z]:/.test(segment)
}

/**
 * Sanitize a single path segment for safe filesystem creation on Windows.
 * - Strips trailing dots and spaces.
 * - Escapes Windows reserved device names by prepending an underscore.
 */
export function sanitizeSegment(rawSegment: string): string {
  let seg = rawSegment.trim()
  // Remove trailing dots and spaces that Windows Win32 strips or rejects
  while (seg.endsWith('.') || seg.endsWith(' ')) {
    seg = seg.slice(0, -1)
  }
  if (!seg) return '_'
  if (isWindowsReservedName(seg)) {
    seg = `_${seg}`
  }
  return seg
}

export interface SafePathResult {
  safeRelativePath: string
  absolutePath: string
}

/**
 * Validates that an archive entry relative path is safe to extract inside destDir.
 * Defenses:
 * - Rejects directory traversal ('..')
 * - Rejects drive-letter paths (e.g. 'C:foo')
 * - Rejects absolute paths ('/etc/passwd', '\Windows')
 * - Sanitizes Windows reserved device names and trailing spaces/dots
 * - Ensures resolved target stays strictly inside destDir
 */
export function validateSafeExtractPath(
  destDir: string,
  rawRelativePath: string
): SafePathResult {
  if (!rawRelativePath || typeof rawRelativePath !== 'string') {
    throw new ArchiveSecurityError(
      'archive.invalid_path',
      'Empty or non-string archive entry path'
    )
  }

  // Normalize separators to forward slashes for segment parsing
  const normalized = rawRelativePath.replace(/\\/g, '/')

  // Reject absolute paths
  if (
    normalized.startsWith('/') ||
    hasDriveLetter(normalized) ||
    hasDriveLetter(rawRelativePath) ||
    path.isAbsolute(rawRelativePath)
  ) {
    throw new ArchiveSecurityError(
      'archive.zip_slip',
      `Absolute or drive-letter paths are forbidden: '${rawRelativePath}'`
    )
  }

  // Split into segments
  const rawSegments = normalized.split('/').filter(Boolean)
  if (rawSegments.length === 0) {
    throw new ArchiveSecurityError(
      'archive.invalid_path',
      'Archive entry contains no path segments'
    )
  }

  // Check each segment for '..'
  for (const seg of rawSegments) {
    if (seg === '..') {
      throw new ArchiveSecurityError(
        'archive.zip_slip',
        `Directory traversal ('..') detected in path: '${rawRelativePath}'`
      )
    }
  }

  // Sanitize segments
  const sanitizedSegments = rawSegments.map((seg) => sanitizeSegment(seg))
  const safeRelativePath = sanitizedSegments.join(path.sep)

  const resolvedDest = path.resolve(destDir)
  const resolvedTarget = path.resolve(resolvedDest, safeRelativePath)

  // Ensure target starts with resolvedDest + path.sep
  if (
    resolvedTarget !== resolvedDest &&
    !resolvedTarget.startsWith(resolvedDest + path.sep)
  ) {
    throw new ArchiveSecurityError(
      'archive.zip_slip',
      `Target path '${resolvedTarget}' escapes destination directory '${resolvedDest}'`
    )
  }

  return {
    safeRelativePath,
    absolutePath: resolvedTarget,
  }
}
