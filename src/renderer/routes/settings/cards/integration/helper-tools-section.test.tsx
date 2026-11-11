import '@testing-library/jest-dom/vitest'
import { useSettingsForm } from '@renderer/components/settings-kit/use-settings-form'
import { transport } from '@renderer/lib/transport'
import { Commands } from '@shared/protocol/commands'
import { Queries } from '@shared/protocol/queries'
import {
  DEFAULT_HELPER_TOOLS_SETTINGS,
  DEFAULT_MCP_SETTINGS,
  DEFAULT_MEDIA_SETTINGS,
} from '@shared/schemas'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormProvider } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { integrationFormSchema } from '../settings-form-schemas'
import { HelperToolsSection } from './helper-tools-section'
import type { IntegrationFormValues } from './integration-dialog'

vi.mock('@renderer/lib/transport', () => ({
  transport: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    platform: 'win32',
  },
}))

function TestWrapper() {
  const form = useSettingsForm<IntegrationFormValues>(integrationFormSchema, {
    app: {
      browserBridgeEnabled: false,
      protocols: { magnet: false },
    },
    media: { ...DEFAULT_MEDIA_SETTINGS },
    mcp: { ...DEFAULT_MCP_SETTINGS },
    helperTools: { ...DEFAULT_HELPER_TOOLS_SETTINGS },
  })

  return (
    <FormProvider {...form}>
      <HelperToolsSection />
    </FormProvider>
  )
}

describe('HelperToolsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(transport.invoke).mockImplementation(async (channel, payload) => {
      if (channel === Queries.GetHelperBinaryInstallStatus) {
        return {
          id: (payload as { id: string }).id,
          phase: 'idle',
          bytesReceived: 0,
          bytesTotal: 0,
          percent: null,
          version: null,
          directory: null,
          error: null,
        }
      }
      if (channel === Queries.GetHelperBinaryDetection) {
        const id = (payload as { id: string }).id
        if (id === 'yt-dlp') {
          return {
            id: 'yt-dlp',
            active: { path: 'C:\\bin\\yt-dlp.exe', version: '2025.02.19' },
            candidates: [],
          }
        }
        return {
          id,
          active: null,
          candidates: [],
        }
      }
      if (channel === Commands.InstallHelperBinary) {
        return {
          ok: true,
          id: (payload as { id: string }).id,
          version: '1.28.5',
        }
      }
      return null
    })
  })

  it('renders all three helper tool cards', async () => {
    render(<TestWrapper />)

    expect(await screen.findByTestId('helper-tool-card-yt-dlp')).toBeInTheDocument()
    expect(screen.getByTestId('helper-tool-card-gallery-dl')).toBeInTheDocument()
    expect(screen.getByTestId('helper-tool-card-deno')).toBeInTheDocument()

    // yt-dlp has mock active detection
    expect(await screen.findByText('2025.02.19')).toBeInTheDocument()
  })

  it('invokes InstallHelperBinary on install click', async () => {
    render(<TestWrapper />)

    const galleryCard = await screen.findByTestId('helper-tool-card-gallery-dl')
    const installBtn = galleryCard.querySelector('button')
    expect(installBtn).not.toBeNull()

    if (installBtn) {
      fireEvent.click(installBtn)
      await waitFor(() => {
        expect(transport.invoke).toHaveBeenCalledWith(
          Commands.InstallHelperBinary,
          { id: 'gallery-dl' }
        )
      })
    }
  })
})
