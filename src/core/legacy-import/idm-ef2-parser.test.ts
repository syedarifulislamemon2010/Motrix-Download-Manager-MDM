// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseIdmEf2, parseIdmEf2AsLegacySession } from './idm-ef2-parser'
import { getLegacyRequestValues } from './session-parser'

const encode = (s: string) => new TextEncoder().encode(s)

describe('idm-ef2-parser', () => {
  it('parses standard IDM .ef2 blocks with headers, filepath, and filename', () => {
    const ef2Content = `
<
https://downloads.example.com/archive.zip
referer: https://example.com/downloads
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Cookie: session_token=secret_12345; auth=ok
filepath: C:\\Users\\User\\Downloads\\
filename: custom_archive.zip
>
<
https://mirror.example.com/video.mp4
Referer: https://example.com/video/123
file: video.mp4
path: D:\\Media\\
>
`
    const records = parseIdmEf2(ef2Content)
    expect(records).toHaveLength(2)

    expect(records[0]).toEqual({
      url: 'https://downloads.example.com/archive.zip',
      referer: 'https://example.com/downloads',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      cookies: 'session_token=secret_12345; auth=ok',
      filepath: 'C:\\Users\\User\\Downloads\\',
      filename: 'custom_archive.zip',
      postData: undefined,
      headers: {},
    })

    expect(records[1]).toEqual({
      url: 'https://mirror.example.com/video.mp4',
      referer: 'https://example.com/video/123',
      userAgent: undefined,
      cookies: undefined,
      filepath: 'D:\\Media\\',
      filename: 'video.mp4',
      postData: undefined,
      headers: {},
    })
  })

  it('handles CRLF line endings, UTF-8 BOM, and comments correctly', () => {
    const raw =
      '\uFEFF# IDM Export File\r\n' +
      '<\r\n' +
      'https://example.com/test.bin\r\n' +
      '# some comments\r\n' +
      'cookie: id=abc\r\n' +
      '>\r\n'

    const records = parseIdmEf2(encode(raw))
    expect(records).toHaveLength(1)
    expect(records[0].url).toBe('https://example.com/test.bin')
    expect(records[0].cookies).toBe('id=abc')
  })

  it('converts to LegacySessionEntry while keeping sensitive cookies and auth private', () => {
    const ef2Content = `
<
https://example.com/secure.tar.gz
cookie: auth_token=secret_password_here
referer: https://portal.example.com/
filepath: C:\\Data
filename: secure.tar.gz
>
`
    const entries = parseIdmEf2AsLegacySession(encode(ef2Content))
    expect(entries).toHaveLength(1)
    const entry = entries[0]

    expect(entry.uris).toEqual(['https://example.com/secure.tar.gz'])
    expect(entry.options.dir).toBe('C:\\Data')
    expect(entry.options.out).toBe('secure.tar.gz')
    expect(entry.reason).toBe('request-settings-required')
    expect(entry.requestOptions).toContain('header')
    expect(entry.requestOptions).toContain('referer')

    // Verify sensitive data does not leak into public JSON
    const serialized = JSON.stringify(entry)
    expect(serialized).not.toContain('secret_password_here')

    // Verify sensitive data is safely accessible via WeakMap
    const privateValues = getLegacyRequestValues(entry)
    expect(privateValues.header).toContain(
      'Cookie: auth_token=secret_password_here'
    )
    expect(privateValues.referer).toEqual(['https://portal.example.com/'])
  })

  it('detects and flags malformed URLs and duplicate entries', () => {
    const ef2Content = `
<
ftp://valid-ftp.example.org/file.iso
>
<
not-a-valid-url
>
<
ftp://valid-ftp.example.org/file.iso
>
`
    const entries = parseIdmEf2AsLegacySession(ef2Content)
    expect(entries).toHaveLength(3)

    // Second entry has invalid URL format
    expect(entries[1].reason).toBe('invalid-record')

    // First and third entries are duplicate identical downloads
    expect(entries[0].reason).toBe('invalid-record')
    expect(entries[2].reason).toBe('invalid-record')
  })

  it('throws on oversized input or null bytes', () => {
    expect(() => parseIdmEf2('https://example.com/\0hack')).toThrow(
      'legacyImport.invalidSource'
    )

    const huge = new Uint8Array(8 * 1024 * 1024 + 1)
    expect(() => parseIdmEf2(huge)).toThrow('legacyImport.tooLarge')
  })
})
