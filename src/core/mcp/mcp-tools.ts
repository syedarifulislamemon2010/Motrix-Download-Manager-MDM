import type { McpTool } from './mcp-types'

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'motrix_list_tasks',
    description:
      'List download tasks in Motrix with their current status, progress, transfer speeds, and filenames.',
    requiredTier: 'read_only',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'waiting', 'paused', 'completed', 'error', 'all'],
          description: 'Filter downloads by status (defaults to "all")',
        },
      },
    },
  },
  {
    name: 'motrix_get_task',
    description:
      'Get comprehensive information about a single download task by its task ID, including file paths, piece map, and error details.',
    requiredTier: 'read_only',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The Motrix download task ID',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'motrix_get_stats',
    description:
      'Get global transfer statistics from Motrix: overall download speed, upload speed, and counts of active/waiting/stopped tasks.',
    requiredTier: 'read_only',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'motrix_get_engine_status',
    description:
      'Check the status and health of the Motrix aria2 download engine process.',
    requiredTier: 'read_only',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'motrix_add_task',
    description:
      'Add a new download task in Motrix using one or more URLs, a magnet link, or mirror URLs separated by pipe (|).',
    requiredTier: 'standard',
    inputSchema: {
      type: 'object',
      properties: {
        uris: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of download URLs or magnet links. Multiple mirrors for a single file can be pipe-separated.',
        },
        saveDir: {
          type: 'string',
          description:
            'Optional destination folder path for the download. Defaults to Motrix default save directory.',
        },
        maxConnectionPerServer: {
          type: 'number',
          description:
            'Maximum number of connections per server (1-16, default 16).',
        },
        split: {
          type: 'number',
          description: 'Number of split parts to download (1-64).',
        },
      },
      required: ['uris'],
    },
  },
  {
    name: 'motrix_pause_task',
    description: 'Pause an active or queued download task in Motrix.',
    requiredTier: 'standard',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The Motrix task ID to pause',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'motrix_resume_task',
    description: 'Resume a paused download task in Motrix.',
    requiredTier: 'standard',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The Motrix task ID to resume',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'motrix_remove_task',
    description:
      'Remove a download task from Motrix. Local file deletion from disk requires full permission tier and explicit setting in Motrix.',
    requiredTier: 'full',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The Motrix task ID to remove',
        },
        deleteFiles: {
          type: 'boolean',
          description:
            'Whether to delete downloaded files from disk (defaults to false).',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'motrix_set_speed_limit',
    description:
      'Configure global download and upload speed limits in Motrix (in bytes per second; 0 means unlimited).',
    requiredTier: 'full',
    inputSchema: {
      type: 'object',
      properties: {
        downloadLimit: {
          type: 'number',
          description: 'Max download speed in bytes/sec (0 for unlimited)',
        },
        uploadLimit: {
          type: 'number',
          description: 'Max upload speed in bytes/sec (0 for unlimited)',
        },
      },
    },
  },
]
