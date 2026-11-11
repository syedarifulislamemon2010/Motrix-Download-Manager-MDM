import '@testing-library/jest-dom/vitest'
import '@renderer/lib/i18n'

import { Form } from '@renderer/components/ui/form'
import { transport } from '@renderer/lib/transport'
import { Commands } from '@shared/protocol/commands'
import { Queries } from '@shared/protocol/queries'
import { DEFAULT_AUTO_EXTRACT_SETTINGS } from '@shared/schemas/auto-extract-settings'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoExtractSection } from './auto-extract-section'

vi.mock('@renderer/lib/transport', () => ({
  transport: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

function TestWrapper() {
  const form = useForm()
  return (
    <Form {...form}>
      <AutoExtractSection />
    </Form>
  )
}

describe('AutoExtractSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(transport.invoke).mockImplementation(async (channel: string) => {
      if (channel === Queries.GetAutoExtractSettings) {
        return {
          ...DEFAULT_AUTO_EXTRACT_SETTINGS,
          enabled: true,
          mode: 'subfolder',
          formats: { zip: true, sevenZip: true, rar: true },
          passwordList: ['secret123'],
        }
      }
      if (channel === Queries.Detect7zStatus) {
        return {
          available: true,
          executablePath: 'C:\\Program Files\\7-Zip\\7z.exe',
        }
      }
      return null
    })
  })

  it('renders section and loads current settings', async () => {
    render(<TestWrapper />)

    await waitFor(() => {
      expect(transport.invoke).toHaveBeenCalledWith(
        Queries.GetAutoExtractSettings
      )
      expect(transport.invoke).toHaveBeenCalledWith(Queries.Detect7zStatus)
    })

    expect(screen.getByText('ZIP')).toBeInTheDocument()
    expect(screen.getByText('RAR')).toBeInTheDocument()
    expect(screen.getByText('secret123')).toBeInTheDocument()
  })

  it('adds a new password to the password list', async () => {
    render(<TestWrapper />)

    await waitFor(() => {
      expect(screen.getByText('secret123')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/password/i)
    fireEvent.change(input, { target: { value: 'mypassword' } })

    const addBtn = screen.getByRole('button', { name: /add/i })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(transport.invoke).toHaveBeenCalledWith(
        Commands.SaveAutoExtractSettings,
        expect.objectContaining({
          passwordList: ['secret123', 'mypassword'],
        })
      )
    })
  })
})
