import type { McpPermissionTier } from '@shared/schemas/mcp-settings'

export interface McpJsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  requiredTier: McpPermissionTier
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

export const MCP_ERROR_CODES = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  PermissionDenied: -32001,
  Disabled: -32002,
} as const
