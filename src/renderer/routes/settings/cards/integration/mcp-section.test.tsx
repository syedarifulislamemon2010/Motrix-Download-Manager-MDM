import '@testing-library/jest-dom/vitest'
import { useSettingsForm } from '@renderer/components/settings-kit/use-settings-form'
import '@renderer/lib/i18n'
import { transport } from '@renderer/lib/transport'
import { Commands } from '@shared/protocol/commands'
import { Events } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import { DEFAULT_MCP_SETTINGS, DEFAULT_MEDIA_SETTINGS } from '@shared/schemas'
import type { McpAuditEntry } from '@shared/schemas/mcp-settings'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormProvider } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { integrationFormSchema } from '../settings-form-schemas'
import type { IntegrationFormValues } from './integration-dialog'
import { McpSection } from './mcp-section'

vi.mock('@renderer/lib/transport', () => ({
  transport: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

function TestWrapper({
  defaultValues,
}: {
  defaultValues?: Partial<IntegrationFormValues>
}) {
  const form = useSettingsForm<IntegrationFormValues>(integrationFormSchema, {
    app: {
      browserBridgeEnabled: false,
      protocols: { magnet: false },
    },
    media: { ...DEFAULT_MEDIA_SETTINGS },
    mcp: { ...DEFAULT_MCP_SETTINGS, ...defaultValues?.mcp },
    ...defaultValues,
  })

  return (
    <FormProvider {...form}>
      <McpSection />
    </FormProvider>
  )
}

describe('McpSection', () => {
  const mockSampleLogs: McpAuditEntry[] = [
    {
      id: 'log-1',
      timestamp: 1700000000000,
      tool: 'motrix_list_tasks',
      tier: 'read_only',
      allowed: true,
      status: 'success',
      summary: 'status=active',
    },
    {
      id: 'log-2',
      timestamp: 1700000005000,
      tool: 'motrix_remove_task',
      tier: 'full',
      allowed: false,
      status: 'denied',
      error: 'Requires full permission tier',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(transport.invoke).mockImplementation(async (query) => {
      if (query === Queries.GetMcpAuditLogs) {
        return mockSampleLogs
      }
      if (query === Commands.ClearMcpAuditLogs) {
        return { cleared: true }
      }
      return undefined
    })
  })

  it('renders settings fields and audit logs on mount', async () => {
    render(<TestWrapper />)

    // Verify transport query called for audit logs
    expect(transport.invoke).toHaveBeenCalledWith(
      Queries.GetMcpAuditLogs,
      expect.objectContaining({ limit: 50 })
    )

    // Verify event subscription
    expect(transport.on).toHaveBeenCalledWith(
      Events.McpAuditLogAdded,
      expect.any(Function)
    )

    // Verify audit logs are displayed
    await waitFor(() => {
      expect(screen.getByText('motrix_list_tasks')).toBeInTheDocument()
      expect(screen.getByText('motrix_remove_task')).toBeInTheDocument()
      expect(screen.getByText('ALLOWED')).toBeInTheDocument()
      expect(screen.getByText('DENIED')).toBeInTheDocument()
    })
  })

  it('cleans up event listener on unmount', () => {
    const { unmount } = render(<TestWrapper />)
    unmount()
    expect(transport.off).toHaveBeenCalledWith(
      Events.McpAuditLogAdded,
      expect.any(Function)
    )
  })

  it('clears logs when clear button is clicked', async () => {
    render(<TestWrapper />)

    await waitFor(() => {
      expect(screen.getByText('motrix_list_tasks')).toBeInTheDocument()
    })

    const clearBtn = screen.getByTestId('mcp-clear-logs')
    await act(async () => {
      fireEvent.click(clearBtn)
    })

    expect(transport.invoke).toHaveBeenCalledWith(Commands.ClearMcpAuditLogs)
  })
})
