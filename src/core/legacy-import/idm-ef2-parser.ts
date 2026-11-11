import {
  digestBytes,
  type LegacySessionEntry,
  MAX_LEGACY_BYTES,
  MAX_LEGACY_ITEMS,
  resolveLegacyRequestSettings,
  setLegacyIgnoredOptions,
  setLegacyRequestValues,
} from './session-parser'

const MAX_LINE = 16384

export interface IdmEf2Record {
  url: string
  referer?: string
  userAgent?: string
  cookies?: string
  filepath?: string
  filename?: string
  postData?: string
  headers: Record<string, string>
}

function normalizeInput(input: Uint8Array | string): string {
  let text: string
  if (typeof input === 'string') {
    text = input
  } else {
    if (input.byteLength > MAX_LEGACY_BYTES) {
      throw new Error('legacyImport.tooLarge')
    }
    text = new TextDecoder('utf-8', { fatal: true }).decode(input)
  }
  if (text.includes('\0')) {
    throw new Error('legacyImport.invalidSource')
  }
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  return text
}

/**
 * Parses raw IDM .ef2 export content into structured IdmEf2Record entries.
 */
export function parseIdmEf2(input: Uint8Array | string): IdmEf2Record[] {
  const text = normalizeInput(input)
  const lines = text.split(/\r?\n/)
  const records: IdmEf2Record[] = []

  let inBlock = false
  let currentLines: string[] = []

  const flushBlock = (blockLines: string[]) => {
    if (records.length >= MAX_LEGACY_ITEMS) {
      throw new Error('legacyImport.tooLarge')
    }
    const nonComment = blockLines
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))

    if (nonComment.length === 0) return

    let url = ''
    let referer: string | undefined
    let userAgent: string | undefined
    let cookies: string | undefined
    let filepath: string | undefined
    let filename: string | undefined
    let postData: string | undefined
    const headers: Record<string, string> = {}

    for (const line of nonComment) {
      if (line.length > MAX_LINE) continue

      // Match directives
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const prefix = line.slice(0, colonIdx).trim().toLowerCase()
        const value = line.slice(colonIdx + 1).trim()

        if (prefix === 'http' || prefix === 'https' || prefix === 'ftp') {
          // It's a full URL on a line: e.g. https://...
          if (!url) {
            url = line
            continue
          }
        }

        if (prefix === 'referer') {
          referer = value
          continue
        }
        if (prefix === 'user-agent') {
          userAgent = value
          continue
        }
        if (prefix === 'cookie') {
          cookies = value
          continue
        }
        if (
          prefix === 'filepath' ||
          prefix === 'file path' ||
          prefix === 'path'
        ) {
          filepath = value
          continue
        }
        if (
          prefix === 'filename' ||
          prefix === 'file name' ||
          prefix === 'file'
        ) {
          filename = value
          continue
        }
        if (prefix === 'postdata' || prefix === 'post data') {
          postData = value
          continue
        }

        // Other generic headers
        const headerKey = line.slice(0, colonIdx).trim()
        headers[headerKey] = value
        continue
      }

      // If no colon or not matched, and url is not set yet, set as url candidate
      if (!url) {
        url = line
      }
    }

    if (url) {
      records.push({
        url,
        referer,
        userAgent,
        cookies,
        filepath,
        filename,
        postData,
        headers,
      })
    }
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (trimmed === '<') {
      if (inBlock) {
        flushBlock(currentLines)
      }
      inBlock = true
      currentLines = []
      continue
    }

    if (trimmed === '>') {
      if (inBlock) {
        flushBlock(currentLines)
        inBlock = false
        currentLines = []
      }
      continue
    }

    if (inBlock) {
      currentLines.push(rawLine)
    }
  }

  // Handle case where trailing '>' was omitted
  if (inBlock && currentLines.length > 0) {
    flushBlock(currentLines)
  }

  return records
}

/**
 * Parses IDM .ef2 content and transforms it into Motrix LegacySessionEntry items
 * suitable for Motrix's import-service and source-scanner.
 */
export function parseIdmEf2AsLegacySession(
  input: Uint8Array | string
): LegacySessionEntry[] {
  const records = parseIdmEf2(input)
  const entries: LegacySessionEntry[] = []

  for (const record of records) {
    const options: Record<string, string> = Object.create(null)
    const optionPairs: Array<readonly [string, string]> = []
    const requestValues: Record<string, string[]> = Object.create(null)
    const ignoredOptions = new Set<string>()

    if (record.filepath) {
      options.dir = record.filepath
      optionPairs.push(['dir', record.filepath])
    }
    if (record.filename) {
      options.out = record.filename
      optionPairs.push(['out', record.filename])
    }

    if (record.referer) {
      requestValues.referer = [record.referer]
    }
    if (record.userAgent) {
      requestValues['user-agent'] = [record.userAgent]
    }
    if (record.cookies) {
      requestValues.header ??= []
      requestValues.header.push(`Cookie: ${record.cookies}`)
    }
    for (const [k, v] of Object.entries(record.headers)) {
      requestValues.header ??= []
      requestValues.header.push(`${k}: ${v}`)
    }

    const digest = digestBytes(
      `${record.url}\n${record.filepath ?? ''}\n${record.filename ?? ''}\n${record.cookies ?? ''}`
    )
    const itemKey = `entry:${digest}`

    let reason: LegacySessionEntry['reason'] = null
    if (!/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(record.url)) {
      reason = 'invalid-record'
    }

    const entry: LegacySessionEntry = {
      itemKey,
      digest,
      gid: null,
      uris: [record.url],
      options,
      optionPairs,
      requestOptions: [],
      ignoredOptions: [...ignoredOptions],
      reason,
    }

    setLegacyRequestValues(entry, requestValues)
    setLegacyIgnoredOptions(entry, entry.ignoredOptions)

    const request = resolveLegacyRequestSettings(entry, {}, 'http')
    entry.requestOptions = request.requestOptions
    entry.ignoredOptions = request.ignoredOptions
    if (!entry.reason && request.requestOptions.length > 0) {
      entry.reason = 'request-settings-required'
    }

    entries.push(entry)
  }

  // Detect duplicates
  const counts = new Map<string, number>()
  for (const entry of entries) {
    counts.set(entry.itemKey, (counts.get(entry.itemKey) ?? 0) + 1)
  }
  for (const entry of entries) {
    if ((counts.get(entry.itemKey) ?? 0) > 1) {
      entry.reason = 'invalid-record'
    }
  }

  return entries
}
