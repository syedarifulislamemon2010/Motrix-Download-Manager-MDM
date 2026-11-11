import { CommandIds } from '@shared/commands-catalog'
import { describe, expect, it, vi } from 'vitest'
import { CommandRegistry } from '../command-registry'
import { DEFAULT_MENU_CONTEXT } from '../menu-context'
import type { CommandDeps } from '../types'
import { registerHelpCommands } from './help.commands'

vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('help.commands', () => {
  it('opens pre-filled crash report url when crashReporter is present', async () => {
    const { shell } = await import('electron')
    const mockGetGitHubIssueUrl = vi
      .fn()
      .mockReturnValue(
        'https://github.com/agalwood/Motrix/issues/new?title=PreFilled'
      )

    const registry = new CommandRegistry()
    registerHelpCommands(registry, {} as CommandDeps)

    const deps = {
      crashReporter: {
        getGitHubIssueUrl: mockGetGitHubIssueUrl,
      },
    } as unknown as CommandDeps

    await registry.execute(CommandIds.HelpReportProblem, undefined, {
      menuContext: DEFAULT_MENU_CONTEXT,
      deps,
    })

    expect(mockGetGitHubIssueUrl).toHaveBeenCalledWith(undefined, 'menu:help')
    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://github.com/agalwood/Motrix/issues/new?title=PreFilled'
    )
  })

  it('falls back to default issues URL when crashReporter is missing', async () => {
    const { shell } = await import('electron')
    vi.mocked(shell.openExternal).mockClear()

    const registry = new CommandRegistry()
    registerHelpCommands(registry, {} as CommandDeps)

    const deps = {} as unknown as CommandDeps

    await registry.execute(CommandIds.HelpReportProblem, undefined, {
      menuContext: DEFAULT_MENU_CONTEXT,
      deps,
    })

    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://github.com/agalwood/Motrix/issues/'
    )
  })
})
