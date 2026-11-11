import { config, hooks, http, log } from 'motrix:plugin-api'

const HOSTERS = [
  'rapidgator.net',
  'rg.to',
  '1fichier.com',
  'uploaded.net',
  'ul.to',
  'nitroflare.com',
  'turbobit.net',
  'filefactory.com',
  'uptobox.com',
  'ddownload.com',
  'katfile.com',
  'fikper.com',
  'mega.nz',
  'mediafire.com',
  'alldebrid.com',
  'real-debrid.com',
  'premiumize.me',
  'send.cm',
  'hitfile.net',
  'keep2share.cc',
  'k2s.cc',
]

function isSupportedHoster(url) {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(url)
  if (!m) return false
  const hostname = m[1].toLowerCase()
  return HOSTERS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
}

async function unrestrictRealDebrid(url, apiKey) {
  const resp = await http.request({
    method: 'POST',
    url: 'https://api.real-debrid.com/rest/1.0/unrestrict/link',
    responseType: 'text',
    headers: [
      { name: 'Authorization', value: `Bearer ${apiKey}` },
      { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
    ],
    body: {
      type: 'string',
      data: `link=${encodeURIComponent(url)}`,
    },
    timeoutMs: 15000,
  })

  let data
  try {
    data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body
  } catch {
    throw new Error(
      `Real-Debrid returned non-JSON response (status ${resp.status})`
    )
  }

  if (data?.download) {
    return {
      directUrl: data.download,
      filename: data.filename,
      filesize: data.filesize,
    }
  }

  if (data?.error) {
    if (data.error === 'bad_token')
      throw new Error('Invalid Real-Debrid API token')
    if (data.error === 'link_not_supported')
      throw new Error('Link host is not supported by Real-Debrid')
    if (data.error === 'traffic_exhausted')
      throw new Error('Real-Debrid traffic exhausted')
    throw new Error(`Real-Debrid error: ${data.error}`)
  }

  throw new Error(`Real-Debrid unrestrict failed (HTTP ${resp.status})`)
}

async function unrestrictAllDebrid(url, apiKey) {
  const apiUrl = `https://api.alldebrid.com/v4/link/unlock?apikey=${encodeURIComponent(apiKey)}&link=${encodeURIComponent(url)}`
  const resp = await http.request({
    method: 'GET',
    url: apiUrl,
    responseType: 'text',
    timeoutMs: 15000,
  })

  let data
  try {
    data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body
  } catch {
    throw new Error(
      `AllDebrid returned non-JSON response (status ${resp.status})`
    )
  }

  if (data?.status === 'success' && data.data?.link) {
    return {
      directUrl: data.data.link,
      filename: data.data.filename,
      filesize: data.data.filesize,
    }
  }

  if (data?.error) {
    const msg = data.error.message || data.error.code || 'unknown error'
    throw new Error(`AllDebrid error: ${msg}`)
  }

  throw new Error(`AllDebrid unrestrict failed (HTTP ${resp.status})`)
}

async function unrestrictPremiumize(url, apiKey) {
  const resp = await http.request({
    method: 'POST',
    url: 'https://www.premiumize.me/api/transfer/create',
    responseType: 'text',
    headers: [
      { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
    ],
    body: {
      type: 'string',
      data: `apikey=${encodeURIComponent(apiKey)}&src=${encodeURIComponent(url)}`,
    },
    timeoutMs: 15000,
  })

  let data
  try {
    data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body
  } catch {
    throw new Error(
      `Premiumize returned non-JSON response (status ${resp.status})`
    )
  }

  if (data?.status === 'success' && data.location) {
    return {
      directUrl: data.location,
      filename: data.filename,
      filesize: data.filesize,
    }
  }

  if (data?.message) {
    throw new Error(`Premiumize error: ${data.message}`)
  }

  throw new Error(`Premiumize unrestrict failed (HTTP ${resp.status})`)
}

hooks.beforeCreate(async (ctx) => {
  if (ctx.type !== 'http') return ctx
  const url = ctx.uris[0]
  if (!url || !isSupportedHoster(url)) return ctx

  let fallback = true
  try {
    fallback = (await config.get('fallbackOnFailure')) ?? true
    const autoUnrestrict = (await config.get('autoUnrestrict')) ?? true
    if (!autoUnrestrict) return ctx

    const apiKey = (await config.get('apiKey')) || ''
    if (!apiKey.trim()) {
      log.debug('debrid-resolver: link matched but no API key configured')
      return ctx
    }

    const provider = (await config.get('provider')) || 'real-debrid'
    log.info('debrid-resolver: unrestricting link', { provider, url })
    let result
    if (provider === 'real-debrid') {
      result = await unrestrictRealDebrid(url, apiKey.trim())
    } else if (provider === 'alldebrid') {
      result = await unrestrictAllDebrid(url, apiKey.trim())
    } else if (provider === 'premiumize') {
      result = await unrestrictPremiumize(url, apiKey.trim())
    } else {
      throw new Error(`Unsupported debrid provider: ${provider}`)
    }

    if (result?.directUrl) {
      log.info('debrid-resolver: link unrestricted successfully', {
        provider,
        hasFilename: Boolean(result.filename),
      })
      ctx.update({ uris: [result.directUrl] })
    }
  } catch (err) {
    log.warn('debrid-resolver: unrestrict failed', {
      err: String(err),
    })
    if (!fallback) {
      throw err
    }
  }

  return ctx
})
