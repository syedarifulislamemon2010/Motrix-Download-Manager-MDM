import { config, hooks, http, log } from 'motrix:plugin-api'

const GDRIVE_FILE_RE =
  /^https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([a-zA-Z0-9_-]+)/i
const GDOCS_DOC_RE =
  /^https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i
const GDOCS_SHEET_RE =
  /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i
const GDOCS_SLIDES_RE =
  /^https?:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i

function matchGdriveUrl(url) {
  return (
    GDRIVE_FILE_RE.test(url) ||
    GDOCS_DOC_RE.test(url) ||
    GDOCS_SHEET_RE.test(url) ||
    GDOCS_SLIDES_RE.test(url)
  )
}

function extractFileId(url) {
  const m = GDRIVE_FILE_RE.exec(url)
  return m ? m[1] : null
}

async function resolveGdrive(url) {
  // 1. Google Docs
  const docMatch = GDOCS_DOC_RE.exec(url)
  if (docMatch) {
    const docId = docMatch[1]
    const format = (await config.get('docsExportFormat')) || 'pdf'
    return {
      directUrl: `https://docs.google.com/document/d/${docId}/export?format=${encodeURIComponent(format)}`,
      filename: `document_${docId}.${format}`,
    }
  }

  // 2. Google Sheets
  const sheetMatch = GDOCS_SHEET_RE.exec(url)
  if (sheetMatch) {
    const sheetId = sheetMatch[1]
    const pref = await config.get('docsExportFormat')
    const format = pref === 'docx' ? 'xlsx' : pref || 'xlsx'
    return {
      directUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=${encodeURIComponent(format)}`,
      filename: `spreadsheet_${sheetId}.${format}`,
    }
  }

  // 3. Google Slides
  const slideMatch = GDOCS_SLIDES_RE.exec(url)
  if (slideMatch) {
    const slideId = slideMatch[1]
    const pref = await config.get('docsExportFormat')
    const format =
      pref === 'docx' || pref === 'xlsx' ? 'pptx' : pref || 'pptx'
    return {
      directUrl: `https://docs.google.com/presentation/d/${slideId}/export?format=${encodeURIComponent(format)}`,
      filename: `presentation_${slideId}.${format}`,
    }
  }

  // 4. Google Drive File
  const fileId = extractFileId(url)
  if (!fileId) return null

  // Direct download endpoint with export=download&confirm=t
  const probeUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`

  let res
  try {
    res = await http.request({
      method: 'GET',
      url: probeUrl,
      responseType: 'text',
      redirect: 'manual',
      timeoutMs: 12000,
    })
  } catch (err) {
    log.warn('gdrive probe network request failed, falling back to direct URL', {
      err: String(err),
      msg: err && err.message,
    })
    return { directUrl: probeUrl }
  }

  // If 302/303 redirect, Location header is the final stream
  if (res.status >= 300 && res.status < 400) {
    const locHeader = res.headers?.find(
      (h) => h.name.toLowerCase() === 'location'
    )
    if (locHeader?.value) {
      return { directUrl: locHeader.value }
    }
  }

  const bodyText = typeof res.body === 'string' ? res.body : ''
  const lowerBody = bodyText.toLowerCase()

  // Check for Quota Exceeded error in response
  if (
    lowerBody.includes('download quota for this file has been exceeded') ||
    lowerBody.includes('download quota') ||
    lowerBody.includes('quotaexceeded') ||
    lowerBody.includes(
      'too many users have viewed or downloaded this file recently'
    ) ||
    lowerBody.includes("you can't view or download this file at this time")
  ) {
    throw new Error(
      'Google Drive quota exceeded for this file. Please try again later.'
    )
  }

  // Check for Virus Scan warning page with confirmation token
  if (
    bodyText.includes('Virus scan warning') ||
    bodyText.includes("Google Drive can't scan this file for viruses") ||
    bodyText.includes('confirm=')
  ) {
    // Look for confirm token in HTML
    // 1) form action with confirm parameter
    const actionMatch =
      /action="([^"]*confirm=([a-zA-Z0-9_-]+)[^"]*)"/i.exec(bodyText)
    if (actionMatch) {
      let actionUrl = actionMatch[1].replace(/&amp;/g, '&')
      if (actionUrl.startsWith('/')) {
        actionUrl = `https://drive.usercontent.google.com${actionUrl}`
      }
      return { directUrl: actionUrl }
    }

    // 2) link with confirm parameter
    const linkMatch =
      /href="([^"]*confirm=([a-zA-Z0-9_-]+)[^"]*)"/i.exec(bodyText)
    if (linkMatch) {
      let linkUrl = linkMatch[1].replace(/&amp;/g, '&')
      if (linkUrl.startsWith('/')) {
        linkUrl = `https://drive.usercontent.google.com${linkUrl}`
      }
      return { directUrl: linkUrl }
    }

    // 3) hidden input with name="confirm"
    const inputMatch =
      /name="confirm"\s+value="([a-zA-Z0-9_-]+)"/i.exec(bodyText)
    if (inputMatch) {
      const confirmToken = inputMatch[1]
      return {
        directUrl: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmToken}`,
      }
    }
  }

  return { directUrl: probeUrl }
}

hooks.beforeCreate(async (ctx) => {
  if (ctx.type !== 'http') return ctx
  const url = ctx.uris[0]
  if (!url || !matchGdriveUrl(url)) return ctx

  const fallback = (await config.get('fallbackOnFailure')) ?? true
  try {
    log.info('gdrive-resolver: resolving link', { url })
    const resolved = await resolveGdrive(url)
    if (resolved?.directUrl) {
      log.info('gdrive-resolver: resolved successfully', {
        directUrl: resolved.directUrl,
      })
      ctx.update({ uris: [resolved.directUrl] })
    }
  } catch (e) {
    log.warn('gdrive-resolver: resolution error', { err: String(e) })
    if (!fallback) {
      throw e
    }
  }

  return ctx
})
