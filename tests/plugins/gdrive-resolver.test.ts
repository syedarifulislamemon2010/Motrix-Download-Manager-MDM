import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConfigCapabilityHost } from '@core/plugin/capabilities/config'
import type { CapabilityHost } from '@core/plugin/capabilities/interface'
import { LogCapabilityHost } from '@core/plugin/capabilities/log'
import { HttpCapabilityHost } from '@core/plugin/capabilities/http'
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

const PLUGIN_DIR = path.resolve(__dirname, '../../extra/plugins/community.gdrive-resolver')
const WORKER_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../dist-test/quick-js-worker.cjs'
)

describe('community.gdrive-resolver', () => {
  let rootDir: string
  let pluginsDir: string
  let db: Database.Database
  let mockAgent: MockAgent
  let host: PluginHost | null = null

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), 'gdrive-test-'))
    pluginsDir = path.join(rootDir, 'plugins')
    mkdirSync(pluginsDir, { recursive: true })
    cpSync(PLUGIN_DIR, path.join(pluginsDir, 'community.gdrive-resolver'), {
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

  it('validates manifest successfully', () => {
    const raw = readFileSync(path.join(PLUGIN_DIR, 'motrix-plugin.json'), 'utf8')
    const parsed = parseManifest(raw, {
      hostVersion: '2.5.0',
      origin: 'community',
    })
    expect(parsed.manifest.id).toBe('community.gdrive-resolver')
    expect(parsed.manifest.categories).toContain('site-resolver')
    expect(parsed.manifest.permissions).toContain('http')
    expect(parsed.manifest.contributes.hooks?.beforeCreate?.role).toBe('resolve')
  })

  let currentLogs: LogCapabilityHost | null = null

  async function createOrchestrator(configValues: Record<string, unknown> = {}) {
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
          schemaDefaults: { fallbackOnFailure: true, docsExportFormat: 'pdf' },
          secretFields: new Set(),
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

    await host.activate('community.gdrive-resolver')

    return new HookOrchestrator({
      host,
      createLog: (id) => logs.create(id),
      hookTimeoutMs: { series: 10_000, parallel: 30_000 },
      pluginsDir,
      pluginStorageRootFor: (id) => path.join(pluginsDir, id, 'storage'),
    })
  }

  function makeContext(url: string, taskId = 'test-task-1'): BeforeCreateHttpContextDTO {
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

  it('resolves Google Docs link to export URL', async () => {
    const orch = await createOrchestrator({ docsExportFormat: 'docx' })
    const ctx = makeContext('https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit')

    const result = await orch.runBeforeCreateHttp(ctx, 'test-task-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(
        'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=docx'
      )
    }
  })

  it('resolves Google Sheets link to export URL', async () => {
    const orch = await createOrchestrator({ docsExportFormat: 'xlsx' })
    const ctx = makeContext('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view')

    const result = await orch.runBeforeCreateHttp(ctx, 'test-task-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(
        'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=xlsx'
      )
    }
  })

  it('resolves Google Slides link to export URL', async () => {
    const orch = await createOrchestrator({ docsExportFormat: 'pptx' })
    const ctx = makeContext('https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit')

    const result = await orch.runBeforeCreateHttp(ctx, 'test-task-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(
        'https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=pptx'
      )
    }
  })

  it('resolves Google Drive file with virus scan confirmation bypass', async () => {
    const fileId = '1abcdefghijklmnopqrstuvwxyz-123456'
    mockAgent
      .get('https://drive.usercontent.google.com')
      .intercept({
        path: `/download?id=${fileId}&export=download&confirm=t`,
        method: 'GET',
      })
      .reply(
        200,
        `<html>
          <body>
            <div>Google Drive can't scan this file for viruses.</div>
            <form id="download-form" action="https://drive.usercontent.google.com/download?id=${fileId}&amp;export=download&amp;confirm=t_token_abc123" method="post">
              <input type="submit" value="Download anyway" />
            </form>
          </body>
        </html>`,
        { headers: { 'content-type': 'text/html' } }
      )

    const orch = await createOrchestrator()
    const ctx = makeContext(`https://drive.google.com/file/d/${fileId}/view`)

    const result = await orch.runBeforeCreateHttp(ctx, 'test-task-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t_token_abc123`
      )
    }
  })

  it('detects quota exceeded error and throws when fallbackOnFailure is false', async () => {
    const fileId = '1quotaExceededFileId'
    mockAgent
      .get('https://drive.usercontent.google.com')
      .intercept({
        path: `/download?id=${fileId}&export=download&confirm=t`,
        method: 'GET',
      })
      .reply(
        200,
        `<html>
          <body>
            <h1>Sorry, you can't view or download this file at this time.</h1>
            <p>Too many users have viewed or downloaded this file recently. Please try accessing the file again later.</p>
          </body>
        </html>`,
        { headers: { 'content-type': 'text/html' } }
      )

    const orch = await createOrchestrator({ fallbackOnFailure: false })
    const ctx = makeContext(`https://drive.google.com/file/d/${fileId}/view`)

    // Role 'resolve' is critical -> chain aborts on error
    const result = await orch.runBeforeCreateHttp(ctx, 'test-task-1')
    expect('aborted' in result).toBe(true)
  })

  it('falls back to direct URL when fallbackOnFailure is true', async () => {
    const fileId = '1networkErrorFile'
    mockAgent
      .get('https://drive.usercontent.google.com')
      .intercept({
        path: `/download?id=${fileId}&export=download&confirm=t`,
        method: 'GET',
      })
      .reply(500, 'Server Error')

    const orch = await createOrchestrator({ fallbackOnFailure: true })
    const ctx = makeContext(`https://drive.google.com/file/d/${fileId}/view`)

    const result = await orch.runBeforeCreateHttp(ctx, 'test-task-1')
    expect('final' in result).toBe(true)
    if ('final' in result) {
      expect(result.final.uris[0]).toBe(
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
      )
    }
  })
})
