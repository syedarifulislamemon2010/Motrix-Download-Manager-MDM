import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConfigCapabilityHost } from '@core/plugin/capabilities/config'
import type { CapabilityHost } from '@core/plugin/capabilities/interface'
import { HttpCapabilityHost } from '@core/plugin/capabilities/http'
import { LogCapabilityHost } from '@core/plugin/capabilities/log'
import { HookOrchestrator } from '@core/plugin/hooks/hook-orchestrator'
import { PluginHost } from '@core/plugin/host/plugin-host'
import { parseManifest } from '@core/plugin/manifest/parse'
import { PluginRegistry } from '@core/plugin/plugin-registry'
import { PluginStateStore } from '@core/plugin/state/plugin-state-store'
import { migrate } from '@core/session/migrations'
import type { BeforeCreateHttpContextDTO } from '@shared/types/plugin-hooks'
import Database from 'better-sqlite3'
import { MockAgent } from 'undici'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const PLUGIN_DIR = path.resolve(
  __dirname,
  '../../extra/plugins/community.debrid-resolver'
)
const WORKER_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../dist-test/quick-js-worker.cjs'
)

describe('community.debrid-resolver', () => {
  let rootDir: string
  let pluginsDir: string
  let db: Database.Database
  let mockAgent: MockAgent
  let host: PluginHost | null = null

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), 'debrid-test-'))
    pluginsDir = path.join(rootDir, 'plugins')
    mkdirSync(pluginsDir, { recursive: true })
    cpSync(PLUGIN_DIR, path.join(pluginsDir, 'community.debrid-resolver'), {
      recursive: true,
    })

    db = new Database(':memory:')
    migrate(db)

    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
  })

  afterEach(async () => {
    if (host) {
      await host.shutdown()
      host = null
    }
    await mockAgent.close()
    db.close()
    rmSync(rootDir, { recursive: true, force: true })
  })

  it('validates manifest successfully with secret apiKey', () => {
    const raw = readFileSync(
      path.join(PLUGIN_DIR, 'motrix-plugin.json'),
      'utf8'
    )
    const parsed = parseManifest(raw, {
      hostVersion: '2.5.0',
      origin: 'community',
    })
    expect(parsed.manifest.id).toBe('community.debrid-resolver')
    expect(parsed.manifest.categories).toContain('site-resolver')
    expect(parsed.manifest.permissions).toContain('http')
    expect(parsed.manifest.contributes.hooks?.beforeCreate?.role).toBe('resolve')
    const apiKeySchema = (
      parsed.manifest.contributes.configuration?.schema as {
        properties?: Record<string, { secret?: boolean }>
      }
    )?.properties?.apiKey
    expect(apiKeySchema?.secret).toBe(true)
  })

  let currentLogs: LogCapabilityHost | null = null

  async function createOrchestrator(
    configValues: Record<string, unknown> = {}
  ) {
    const stateStore = new PluginStateStore(db)
    const registry = new PluginRegistry({
      pluginsDir,
      builtinDir: path.join(rootDir, 'builtin'),
      stateStore,
      hostVersion: '2.5.0',
    })
    await registry.discover()

    const logs = new LogCapabilityHost({
      pluginLogsDir: path.join(rootDir, 'logs'),
    })
    currentLogs = logs

    const noop = () => {}
    const capHost: CapabilityHost = {
      createLog: (id: string) => logs.create(id),
      getTail: (id: string, limit: number) => logs.getTail(id, limit),
      clearLog: (id: string) => logs.clear(id),
      setLogVerbose: (id: string, v: boolean) => logs.setVerbose(id, v),
      isLogVerbose: (id: string) => logs.isVerbose(id),
      getLogState: (id: string) => logs.getState(id),
      subscribeLog: () => noop,
      appSnapshot: () => ({
        version: '2.5.0',
        platform: process.platform as 'win32' | 'darwin' | 'linux',
        runtime: 'server',
        locale: 'en-US',
        arch: process.arch as 'x64' | 'arm64',
      }),
      i18nSnapshot: () => ({
        language: 'en-US',
        dir: 'ltr',
        currentDict: {},
        fallbackDict: {},
      }),
      setLocale: noop,
      onLocaleChange: () => noop,
      flush: async () => {},
      http: new HttpCapabilityHost({ dispatcher: mockAgent }),
      configFor: (pluginId: string) =>
        new ConfigCapabilityHost({
          pluginId,
          readValues: () => configValues,
          schemaDefaults: {
            provider: 'real-debrid',
            apiKey: '',
            autoUnrestrict: true,
            fallbackOnFailure: true,
          },
          secretFields: new Set(['apiKey']),
          decryptSecret: (v: string) => v,
        }),
      fsTaskFor: () => null as never,
      fsStorageFor: () => null as never,
      storage: null as never,
      metadata: null as never,
      crypto: null as never,
      lifecycle: null as never,
      commands: null as never,
      notify: null as never,
      ffmpeg: null as never,
      secrets: null as never,
      cookieJarFor: () => null as never,
    }

    host = new PluginHost({
      registry,
      stateStore,
      capabilityHost: capHost,
      workerScriptPath: WORKER_SCRIPT_PATH,
      appVersion: '2.5.0',
      runtime: 'server',
      hostLanguage: 'en-US',
    })

    await host.activate('community.debrid-resolver')

    return new HookOrchestrator({
      host,
      createLog: (id) => logs.create(id),
      hookTimeoutMs: { series: 10_000, parallel: 30_000 },
      pluginsDir,
      pluginStorageRootFor: (id) => path.join(pluginsDir, id, 'storage'),
    })
  }

  function makeContext(
    url: string,
    taskId = 'test-debrid-1'
  ): BeforeCreateHttpContextDTO {
    return {
      schemaVersion: 1,
      invocationId: `inv-${taskId}`,
      taskId,
      type: 'http',
      sourceUrl: url,
      uris: [url],
      saveDir: rootDir,
      headers: [],
      createdBy: 'user',
      requestedAt: Date.now(),
    }
  }

  it('unrestricts Rapidgator link via Real-Debrid', async () => {
    const hosterUrl = 'https://rapidgator.net/file/abc123xyz/sample.rar.html'
    const directDownload = 'https://12.download.real-debrid.com/d/XYZ/sample.rar'

    mockAgent
      .get('https://api.real-debrid.com')
      .intercept({
        path: '/rest/1.0/unrestrict/link',
        method: 'POST',
      })
      .reply(
        200,
        JSON.stringify({
          id: 'unrestrict-1',
          filename: 'sample.rar',
          mimeType: 'application/x-rar',
          filesize: 1048576,
          download: directDownload,
        }),
        { headers: { 'content-type': 'application/json' } }
      )

    const orch = await createOrchestrator({
      provider: 'real-debrid',
      apiKey: 'test-rd-key-12345',
      autoUnrestrict: true,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(directDownload)
    }
  })

  it('unrestricts 1fichier link via AllDebrid', async () => {
    const hosterUrl = 'https://1fichier.com/?abcdefghij'
    const directDownload = 'https://alldebrid.com/dl/xyz/video.mp4'

    mockAgent
      .get('https://api.alldebrid.com')
      .intercept({
        path: (p: string) => p.startsWith('/v4/link/unlock'),
        method: 'GET',
      })
      .reply(
        200,
        JSON.stringify({
          status: 'success',
          data: {
            link: directDownload,
            filename: 'video.mp4',
            filesize: 2097152,
          },
        }),
        { headers: { 'content-type': 'application/json' } }
      )

    const orch = await createOrchestrator({
      provider: 'alldebrid',
      apiKey: 'test-alldebrid-token',
      autoUnrestrict: true,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(directDownload)
    }
  })

  it('unrestricts filehoster link via Premiumize', async () => {
    const hosterUrl = 'https://uploaded.net/file/testfile123'
    const directDownload = 'https://direct.premiumize.me/dl/testfile.zip'

    mockAgent
      .get('https://www.premiumize.me')
      .intercept({
        path: '/api/transfer/create',
        method: 'POST',
      })
      .reply(
        200,
        JSON.stringify({
          status: 'success',
          location: directDownload,
          filename: 'testfile.zip',
        }),
        { headers: { 'content-type': 'application/json' } }
      )

    const orch = await createOrchestrator({
      provider: 'premiumize',
      apiKey: 'test-premiumize-token',
      autoUnrestrict: true,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(directDownload)
    }
  })

  it('leaves URL untouched when not in supported hosters list', async () => {
    const ordinaryUrl = 'https://example.com/some/file.iso'

    const orch = await createOrchestrator({
      provider: 'real-debrid',
      apiKey: 'rd-key',
      autoUnrestrict: true,
    })

    const ctx = makeContext(ordinaryUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(ordinaryUrl)
    }
  })

  it('leaves URL untouched when API key is empty', async () => {
    const hosterUrl = 'https://rapidgator.net/file/123/file.rar'

    const orch = await createOrchestrator({
      provider: 'real-debrid',
      apiKey: '',
      autoUnrestrict: true,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(hosterUrl)
    }
  })

  it('leaves URL untouched when autoUnrestrict is false', async () => {
    const hosterUrl = 'https://rapidgator.net/file/123/file.rar'

    const orch = await createOrchestrator({
      provider: 'real-debrid',
      apiKey: 'rd-key',
      autoUnrestrict: false,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(hosterUrl)
    }
  })

  it('aborts chain on provider error when fallbackOnFailure is false', async () => {
    const hosterUrl = 'https://rapidgator.net/file/123/file.rar'

    mockAgent
      .get('https://api.real-debrid.com')
      .intercept({
        path: '/rest/1.0/unrestrict/link',
        method: 'POST',
      })
      .reply(
        400,
        JSON.stringify({
          error: 'bad_token',
          error_code: 8,
        }),
        { headers: { 'content-type': 'application/json' } }
      )

    const orch = await createOrchestrator({
      provider: 'real-debrid',
      apiKey: 'bad-key',
      autoUnrestrict: true,
      fallbackOnFailure: false,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('aborted' in result).toBe(true)
  })

  it('proceeds with original URL on error when fallbackOnFailure is true', async () => {
    const hosterUrl = 'https://rapidgator.net/file/123/file.rar'

    mockAgent
      .get('https://api.real-debrid.com')
      .intercept({
        path: '/rest/1.0/unrestrict/link',
        method: 'POST',
      })
      .reply(500, 'Server Error')

    const orch = await createOrchestrator({
      provider: 'real-debrid',
      apiKey: 'rd-key',
      autoUnrestrict: true,
      fallbackOnFailure: true,
    })

    const ctx = makeContext(hosterUrl)
    const result = await orch.runBeforeCreateHttp(ctx, 'test-debrid-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(hosterUrl)
    }
  })
})
