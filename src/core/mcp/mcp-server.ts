import type { GlobalStats } from '@shared/types/stats'
import type { DownloadTask } from '@shared/types/task'
import { TaskStatus } from '@shared/types/task'
import type { McpAuditLog } from './mcp-audit-log'
import type { McpPermissionGuard } from './mcp-permission-guard'
import { MCP_TOOLS } from './mcp-tools'
import {
  MCP_ERROR_CODES,
  type McpJsonRpcRequest,
  type McpJsonRpcResponse,
  type McpToolCallResult,
} from './mcp-types'

export interface McpServerDeps {
  permissionGuard: McpPermissionGuard
  auditLog: McpAuditLog
  taskManager: {
    getAll: () => DownloadTask[]
    getById: (id: string) => DownloadTask | undefined
  }
  engineAdapter: {
    getGlobalStats: () => Promise<GlobalStats>
    changeGlobalOption?: (options: Record<string, string>) => Promise<unknown>
  }
  getEngineStatus: () => { state: string; version?: string }
  createTask?: (request: {
    uris: string[]
    saveDir?: string
    split?: number
    maxConnectionPerServer?: number
  }) => Promise<{ taskId: string; gid?: string; gids?: string[] }>
  pauseTask: (taskId: string) => Promise<unknown>
  resumeTask: (taskId: string) => Promise<unknown>
  removeTask: (
    taskId: string,
    opts: { deleteFiles: boolean }
  ) => Promise<unknown>
  setSpeedLimits?: (limits: {
    download?: number
    upload?: number
  }) => Promise<unknown>
}

export class McpServer {
  constructor(private readonly deps: McpServerDeps) {}

  async handleMessage(rawMessage: unknown): Promise<McpJsonRpcResponse | null> {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: MCP_ERROR_CODES.ParseError,
          message: 'Invalid JSON-RPC request',
        },
      }
    }

    const req = rawMessage as Partial<McpJsonRpcRequest>
    const id = req.id ?? null

    if (!req.method || typeof req.method !== 'string') {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.InvalidRequest,
          message: 'Missing or invalid "method" in request',
        },
      }
    }

    // Notifications (no id)
    if (req.id === undefined) {
      if (req.method === 'notifications/initialized') {
        return null // Acknowledged
      }
      return null
    }

    switch (req.method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'motrix-mcp',
              version: '2.4.1',
            },
          },
        }
      }

      case 'ping': {
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        }
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS.map((t) => ({
              name: t.name,
              description: `[Tier: ${t.requiredTier}] ${t.description}`,
              inputSchema: t.inputSchema,
            })),
          },
        }
      }

      case 'tools/call': {
        const params = req.params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined
        const toolName = params?.name
        const toolArgs = params?.arguments ?? {}

        if (!toolName || typeof toolName !== 'string') {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.InvalidParams,
              message: 'Missing "name" in tools/call parameters',
            },
          }
        }

        const toolDef = MCP_TOOLS.find((t) => t.name === toolName)
        if (!toolDef) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.MethodNotFound,
              message: `Tool '${toolName}' is not recognized`,
            },
          }
        }

        // Permission check
        const perm = this.deps.permissionGuard.checkToolPermission(
          toolDef.requiredTier,
          toolName,
          toolArgs
        )

        if (!perm.allowed) {
          this.deps.auditLog.record({
            tool: toolName,
            params: toolArgs,
            tier: toolDef.requiredTier,
            allowed: false,
            status: 'denied',
            error: perm.reason,
          })

          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.PermissionDenied,
              message: perm.reason ?? 'Permission denied',
            },
          }
        }

        // Execute tool action
        try {
          const resultData = await this.executeTool(toolName, toolArgs)
          this.deps.auditLog.record({
            tool: toolName,
            params: toolArgs,
            tier: toolDef.requiredTier,
            allowed: true,
            status: 'success',
            summary: resultData.summary,
          })

          const mcpResult: McpToolCallResult = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(resultData.data, null, 2),
              },
            ],
          }

          return {
            jsonrpc: '2.0',
            id,
            result: mcpResult,
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          this.deps.auditLog.record({
            tool: toolName,
            params: toolArgs,
            tier: toolDef.requiredTier,
            allowed: true,
            status: 'error',
            error: errMsg,
          })

          const mcpResult: McpToolCallResult = {
            content: [
              {
                type: 'text',
                text: `Error executing ${toolName}: ${errMsg}`,
              },
            ],
            isError: true,
          }

          return {
            jsonrpc: '2.0',
            id,
            result: mcpResult,
          }
        }
      }

      default: {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: MCP_ERROR_CODES.MethodNotFound,
            message: `Method '${req.method}' not found`,
          },
        }
      }
    }
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; summary?: string }> {
    switch (name) {
      case 'motrix_list_tasks': {
        const allTasks = this.deps.taskManager.getAll()
        const statusFilter = (args.status as string) || 'all'

        const filtered = allTasks.filter((t) => {
          if (statusFilter === 'all') return true
          if (statusFilter === 'active') {
            return (
              t.status === TaskStatus.Downloading ||
              t.status === TaskStatus.FetchingMetadata
            )
          }
          if (statusFilter === 'waiting') return t.status === TaskStatus.Queued
          if (statusFilter === 'paused') return t.status === TaskStatus.Paused
          if (statusFilter === 'completed') {
            return (
              t.status === TaskStatus.Completed ||
              t.status === TaskStatus.Seeding
            )
          }
          if (statusFilter === 'error') return t.status === TaskStatus.Error
          return true
        })

        const mapped = filtered.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          totalLength: t.totalBytes,
          completedLength: t.downloadedBytes,
          downloadSpeed: t.downloadSpeed,
          uploadSpeed: t.uploadSpeed,
          progress: t.progress,
        }))

        return {
          data: { total: mapped.length, tasks: mapped },
          summary: `Listed ${mapped.length} tasks (filter: ${statusFilter})`,
        }
      }

      case 'motrix_get_task': {
        const taskId = String(args.taskId)
        const task = this.deps.taskManager.getById(taskId)
        if (!task) {
          throw new Error(`Task with ID '${taskId}' not found`)
        }
        return {
          data: task,
          summary: `Fetched details for task '${task.name}' (${taskId})`,
        }
      }

      case 'motrix_get_stats': {
        const stats = await this.deps.engineAdapter.getGlobalStats()
        return {
          data: stats,
          summary: `Current DL: ${stats.totalDownloadSpeed} B/s, UL: ${stats.totalUploadSpeed} B/s`,
        }
      }

      case 'motrix_get_engine_status': {
        const status = this.deps.getEngineStatus()
        return {
          data: status,
          summary: `Engine state: ${status.state}`,
        }
      }

      case 'motrix_add_task': {
        if (!this.deps.createTask) {
          throw new Error('Task creation capability is not available')
        }
        const rawUris = args.uris
        const uris = Array.isArray(rawUris)
          ? rawUris.map(String)
          : [String(rawUris)]

        const result = await this.deps.createTask({
          uris,
          saveDir: args.saveDir ? String(args.saveDir) : undefined,
          split: typeof args.split === 'number' ? args.split : undefined,
          maxConnectionPerServer:
            typeof args.maxConnectionPerServer === 'number'
              ? args.maxConnectionPerServer
              : undefined,
        })

        return {
          data: result,
          summary: `Created task with ID '${result.taskId}' (${uris.length} URI(s))`,
        }
      }

      case 'motrix_pause_task': {
        const taskId = String(args.taskId)
        await this.deps.pauseTask(taskId)
        return {
          data: { ok: true, taskId },
          summary: `Paused task '${taskId}'`,
        }
      }

      case 'motrix_resume_task': {
        const taskId = String(args.taskId)
        await this.deps.resumeTask(taskId)
        return {
          data: { ok: true, taskId },
          summary: `Resumed task '${taskId}'`,
        }
      }

      case 'motrix_remove_task': {
        const taskId = String(args.taskId)
        const deleteFiles = Boolean(args.deleteFiles)
        await this.deps.removeTask(taskId, { deleteFiles })
        return {
          data: { ok: true, taskId, deleteFiles },
          summary: `Removed task '${taskId}' (deleteFiles: ${deleteFiles})`,
        }
      }

      case 'motrix_set_speed_limit': {
        const dl =
          typeof args.downloadLimit === 'number'
            ? args.downloadLimit
            : undefined
        const ul =
          typeof args.uploadLimit === 'number' ? args.uploadLimit : undefined

        if (this.deps.setSpeedLimits) {
          await this.deps.setSpeedLimits({ download: dl, upload: ul })
        } else if (this.deps.engineAdapter.changeGlobalOption) {
          const opts: Record<string, string> = {}
          if (dl !== undefined) opts['max-overall-download-limit'] = String(dl)
          if (ul !== undefined) opts['max-overall-upload-limit'] = String(ul)
          await this.deps.engineAdapter.changeGlobalOption(opts)
        }

        return {
          data: { ok: true, downloadLimit: dl, uploadLimit: ul },
          summary: `Configured speed limits: DL=${dl ?? 'unchanged'}, UL=${ul ?? 'unchanged'}`,
        }
      }

      default:
        throw new Error(`Unhandled tool: ${name}`)
    }
  }
}
