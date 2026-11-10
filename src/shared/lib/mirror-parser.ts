import type { SourceReason } from '@shared/schemas/download-source'
import { analyzeDownloadSource } from './download-source'

export interface MirrorParseResult {
  raw: string
  uris: string[]
  primaryUrl: string
  valid: boolean
  errorReason?: SourceReason
  errorOffset?: { start: number; end: number }
}

/**
 * Parses a single input line that may contain mirrors separated by pipe ('|').
 * Example: "https://srv1.com/file.iso | https://srv2.com/file.iso"
 *
 * Edge cases handled:
 * - Empty or whitespace-only lines return null
 * - Whitespace around pipes is trimmed
 * - Empty segments (e.g. "url || mirror" or leading/trailing pipes) are ignored
 * - Duplicate URLs are deduplicated preserving the first occurrence
 * - Mixed protocols (e.g. magnet with http mirrors) are rejected
 * - Invalid URLs / schemes flag valid: false with source reason and offset
 */
export function parseMirrorLine(line: string): MirrorParseResult | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Fast path: no pipe character
  if (!line.includes('|')) {
    const analysis = analyzeDownloadSource(trimmed)
    if (analysis.status === 'accepted') {
      return {
        raw: line,
        uris: [analysis.sourceUrl],
        primaryUrl: analysis.sourceUrl,
        valid: true,
      }
    }
    const leading = line.length - line.replace(/^ +/, '').length
    return {
      raw: line,
      uris: [trimmed],
      primaryUrl: trimmed,
      valid: false,
      errorReason: analysis.diagnostic.reason,
      errorOffset: {
        start: leading + analysis.diagnostic.start,
        end: leading + analysis.diagnostic.end,
      },
    }
  }

  // Segment by pipe while tracking exact character offsets in the original line
  const segments: Array<{ text: string; start: number; end: number }> = []
  let searchFrom = 0
  while (searchFrom <= line.length) {
    const pipeIndex = line.indexOf('|', searchFrom)
    const rawSegment =
      pipeIndex === -1
        ? line.slice(searchFrom)
        : line.slice(searchFrom, pipeIndex)
    const segStart = searchFrom
    const segEnd = pipeIndex === -1 ? line.length : pipeIndex

    // Compute trimmed segment coordinates
    const leadingSpaces =
      rawSegment.length - rawSegment.replace(/^ +/, '').length
    const trailingSpaces =
      rawSegment.length - rawSegment.replace(/ +$/, '').length
    const cleanText = rawSegment.slice(
      leadingSpaces,
      rawSegment.length - trailingSpaces
    )

    if (cleanText.length > 0) {
      segments.push({
        text: cleanText,
        start: segStart + leadingSpaces,
        end: segEnd - trailingSpaces,
      })
    }

    if (pipeIndex === -1) break
    searchFrom = pipeIndex + 1
  }

  if (segments.length === 0) return null

  // Check for invalid combinations, e.g. magnet mixed with other mirrors
  const magnetSeg = segments.find((s) => s.text.startsWith('magnet:?'))
  if (magnetSeg && segments.length > 1) {
    return {
      raw: line,
      uris: segments.map((s) => s.text),
      primaryUrl: segments[0].text,
      valid: false,
      errorReason: 'mixedProtocols',
      errorOffset: { start: magnetSeg.start, end: magnetSeg.end },
    }
  }

  const uris: string[] = []
  const seen = new Set<string>()

  for (const seg of segments) {
    const analysis = analyzeDownloadSource(seg.text)
    if (analysis.status !== 'accepted') {
      return {
        raw: line,
        uris: segments.map((s) => s.text),
        primaryUrl: uris[0] ?? segments[0].text,
        valid: false,
        errorReason: analysis.diagnostic.reason,
        errorOffset: {
          start: seg.start + analysis.diagnostic.start,
          end: seg.start + analysis.diagnostic.end,
        },
      }
    }

    if (!seen.has(analysis.sourceUrl)) {
      seen.add(analysis.sourceUrl)
      uris.push(analysis.sourceUrl)
    }
  }

  return {
    raw: line,
    uris,
    primaryUrl: uris[0],
    valid: uris.length > 0,
  }
}

/**
 * Extracts all unique mirror URLs from a line, returning an empty array if invalid or empty.
 */
export function parseMirrorUrls(line: string): string[] {
  const result = parseMirrorLine(line)
  return result?.valid ? result.uris : []
}
