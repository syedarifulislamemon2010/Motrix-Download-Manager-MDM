import { describe, expect, it } from 'vitest'
import { parseMirrorLine, parseMirrorUrls } from './mirror-parser'

describe('mirror-parser', () => {
  it('returns null for empty or whitespace-only lines', () => {
    expect(parseMirrorLine('')).toBeNull()
    expect(parseMirrorLine('   ')).toBeNull()
    expect(parseMirrorLine('\t\n')).toBeNull()
  })

  it('parses a single URL without pipes', () => {
    const res = parseMirrorLine('https://example.com/file.iso')
    expect(res).not.toBeNull()
    expect(res?.valid).toBe(true)
    expect(res?.uris).toEqual(['https://example.com/file.iso'])
    expect(res?.primaryUrl).toBe('https://example.com/file.iso')
  })

  it('parses multiple mirror URLs separated by pipe', () => {
    const line =
      'https://server1.com/file.iso | https://server2.org/file.iso | ftp://server3.net/file.iso'
    const res = parseMirrorLine(line)
    expect(res).not.toBeNull()
    expect(res?.valid).toBe(true)
    expect(res?.uris).toEqual([
      'https://server1.com/file.iso',
      'https://server2.org/file.iso',
      'ftp://server3.net/file.iso',
    ])
    expect(res?.primaryUrl).toBe('https://server1.com/file.iso')
  })

  it('handles leading and trailing pipes gracefully', () => {
    const line =
      ' | https://server1.com/file.iso | https://server2.com/file.iso | '
    const res = parseMirrorLine(line)
    expect(res?.valid).toBe(true)
    expect(res?.uris).toEqual([
      'https://server1.com/file.iso',
      'https://server2.com/file.iso',
    ])
  })

  it('ignores consecutive empty pipes', () => {
    const line = 'https://server1.com/file.iso ||| https://server2.com/file.iso'
    const res = parseMirrorLine(line)
    expect(res?.valid).toBe(true)
    expect(res?.uris).toEqual([
      'https://server1.com/file.iso',
      'https://server2.com/file.iso',
    ])
  })

  it('deduplicates identical mirror URLs while preserving order', () => {
    const line =
      'https://server1.com/file.iso | https://server2.com/file.iso | https://server1.com/file.iso'
    const res = parseMirrorLine(line)
    expect(res?.valid).toBe(true)
    expect(res?.uris).toEqual([
      'https://server1.com/file.iso',
      'https://server2.com/file.iso',
    ])
  })

  it('rejects line when a mirror has an invalid scheme or is malformed', () => {
    const line = 'https://server1.com/file.iso | not-a-valid-url'
    const res = parseMirrorLine(line)
    expect(res?.valid).toBe(false)
    expect(res?.errorReason).toBe('missingScheme')
    expect(res?.errorOffset?.start).toBeGreaterThan(0)
  })

  it('rejects line when a mirror has an unsupported protocol', () => {
    const line = 'https://server1.com/file.iso | gopher://server2.com/file.iso'
    const res = parseMirrorLine(line)
    expect(res?.valid).toBe(false)
    expect(res?.errorReason).toBe('unsupportedProtocol')
  })

  it('rejects combining magnet links with mirrors (mixedProtocols)', () => {
    const line =
      'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567 | https://server1.com/file.iso'
    const res = parseMirrorLine(line)
    expect(res?.valid).toBe(false)
    expect(res?.errorReason).toBe('mixedProtocols')
  })

  it('returns empty array from parseMirrorUrls when input is invalid or empty', () => {
    expect(parseMirrorUrls('')).toEqual([])
    expect(parseMirrorUrls('invalid-url | ftp://bad')).toEqual([])
  })

  it('returns array of uris from parseMirrorUrls when input is valid', () => {
    expect(parseMirrorUrls('https://a.com/file | https://b.com/file')).toEqual([
      'https://a.com/file',
      'https://b.com/file',
    ])
  })
})
