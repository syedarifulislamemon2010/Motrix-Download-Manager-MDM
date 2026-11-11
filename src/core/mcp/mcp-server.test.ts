import type { McpSettings } from '@shared/schemas/mcp-settings'
import type { DownloadTask } from '@shared/types/task'
import { TaskStatus, TaskType } from '@shared/types/task'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { McpAuditLog } from './mcp-audit-log'
import { McpPermissionGuard } from './mcp-permission-guard'
import { McpServer } from './mcp-server'
import { MCP_ERROR_CODES } from './mcp-types'

describe('McpServer', () => {
  let settings: McpSettings
  let permissionGuard: McpPermissionGuard
  let auditLog: McpAuditLog
  let tasks: DownloadTask[]
  let server: McpServer

  beforeEach(() => {
    settings = {
      enabled: true,
      permissionTier: 'standard',
      allowDeleteFiles: false,
      maxLogEntries: 100,
    }
    permissionGuard = new McpPermissionGuard(() => settings)
    auditLog = new McpAuditLog({ getSettings: () => settings })

    tasks = [
      {
        id: 'task-1',
        name: 'ubuntu-24.04.iso',
        status: TaskStatus.Downloading,
        totalLength: 1000,
        completedLength: 500,
        downloadSpeed: 50000,
        uploadSpeed: 0,
        type: TaskType.Http,
        split: 16,
        engineGid: 'gid-1',
        connections: 16,
        dir: '/downloads',
        files: [],
      } as unknown as DownloadTask,
      {
        id: 'task-2',
        name: 'debian.iso',
        status: TaskStatus.Completed,
        totalLength: 2000,
        completedLength: 2000,
        downloadSpeed: 0,
        uploadSpeed: 0,
        type: TaskType.Http,
        split: 16,
        engineGid: 'gid-2',
        connections: 0,
        dir: '/downloads',
        files: [],
      } as unknown as DownloadTask,
    ]

    server = new McpServer({
      permissionGuard,
      auditLog,
      taskManager: {
        getAll: () => tasks,
        getById: (id: string) => tasks.find((t) => t.id === id),
      },
      engineAdapter: {
        getGlobalStats: async () => ({
          totalDownloadSpeed: 50000,
          totalUploadSpeed: 0,
          activeTasks: 1,
          waitingTasks: 0,
          stoppedTasks: 1,
        }),
      },
      getEngineStatus: () => ({ state: 'ready', version: '1.37.0' }),
      createTask: vi.fn(async () => ({
        taskId: 'new-task-1',
        gids: ['gid-new'],
      })),
      pauseTask: vi.fn(async () => {}),
      resumeTask: vi.fn(async () => {}),
      removeTask: vi.fn(async () => {}),
      setSpeedLimits: vi.fn(async () => {}),
    })
  })

  it('responds to initialize and ping', async () => {
    const initRes = await server.handleMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    })
    expect(initRes?.result).toMatchObject({
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'motrix-mcp' },
    })

    const pingRes = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
    })
    expect(pingRes?.result).toEqual({})
  })

  it('lists available tools with descriptions and required tiers', async () => {
    const res = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
    })
    expect(res?.result).toBeDefined()
    const toolsResult = res?.result as { tools: Array<{ name: string }> }
    const tools = toolsResult.tools
    expect(tools.length).toBeGreaterThanOrEqual(8)
    expect(tools.some((t) => t.name === 'motrix_list_tasks')).toBe(true)
    expect(tools.some((t) => t.name === 'motrix_add_task')).toBe(true)
  })

  it('executes motrix_list_tasks and records audit log', async () => {
    const res = await server.handleMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'motrix_list_tasks',
        arguments: { status: 'active' },
      },
    })

    expect(res?.error).toBeUndefined()
    expect(res?.result).toBeDefined()
    const callResult = res?.result as { content: Array<{ text: string }> }
    const content = callResult.content[0].text
    const parsed = JSON.parse(content)
    expect(parsed.total).toBe(1)
    expect(parsed.tasks[0].id).toBe('task-1')

    const logs = auditLog.getEntries()
    expect(logs).toHaveLength(1)
    expect(logs[0].tool).toBe('motrix_list_tasks')
    expect(logs[0].status).toBe('success')
  })

  it('executes motrix_add_task on standard tier', async () => {
    const res = await server.handleMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'motrix_add_task',
        arguments: { uris: ['https://example.com/test.zip'] },
      },
    })

    expect(res?.error).toBeUndefined()
    const logs = auditLog.getEntries()
    expect(logs[0].tool).toBe('motrix_add_task')
    expect(logs[0].status).toBe('success')
  })

  it('denies full-tier tool when current tier is standard', async () => {
    const res = await server.handleMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'motrix_remove_task',
        arguments: { taskId: 'task-1' },
      },
    })

    expect(res?.error).toBeDefined()
    expect(res?.error?.code).toBe(MCP_ERROR_CODES.PermissionDenied)

    const logs = auditLog.getEntries()
    expect(logs[0].tool).toBe('motrix_remove_task')
    expect(logs[0].status).toBe('denied')
  })

  it('allows remove_task when tier is full and respects allowDeleteFiles', async () => {
    settings.permissionTier = 'full'
    settings.allowDeleteFiles = true

    const res = await server.handleMessage({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'motrix_remove_task',
        arguments: { taskId: 'task-1', deleteFiles: true },
      },
    })

    expect(res?.error).toBeUndefined()
    const logs = auditLog.getEntries()
    expect(logs[0].tool).toBe('motrix_remove_task')
    expect(logs[0].status).toBe('success')
  })
})
