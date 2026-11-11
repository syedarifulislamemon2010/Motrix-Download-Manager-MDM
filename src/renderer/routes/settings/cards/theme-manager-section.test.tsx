import '@testing-library/jest-dom/vitest'
import '@renderer/lib/i18n'

import { useThemeManager } from '@renderer/themes/theme-manager'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeManagerSection } from './theme-manager-section'

describe('ThemeManagerSection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThemeManager.setState({
      activeThemeId: 'default',
      customThemes: [],
      contrastWarnings: [],
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders preset selection and import button', () => {
    render(<ThemeManagerSection />)
    expect(screen.getByText('Theme Preset')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /import theme/i })
    ).toBeInTheDocument()
  })

  it('displays swatches and export button when preset is active', () => {
    useThemeManager.getState().selectTheme('dracula')
    render(<ThemeManagerSection />)

    expect(screen.getByText('Dracula')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /export json/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /export base16/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /reset to default/i })
    ).toBeInTheDocument()
  })

  it('shows contrast warning when theme has low contrast', () => {
    const lowContrastTheme = {
      id: 'low-contrast',
      name: 'Low Contrast',
      variant: 'dark' as const,
      colors: {
        background: '#333333',
        foreground: '#383838', // very low contrast
        card: '#333333',
        cardForeground: '#383838',
        popover: '#333333',
        popoverForeground: '#383838',
        primary: '#333333',
        primaryForeground: '#383838',
        secondary: '#333333',
        secondaryForeground: '#383838',
        muted: '#333333',
        mutedForeground: '#383838',
        accent: '#333333',
        accentForeground: '#383838',
        destructive: '#ff0000',
        border: '#333333',
        input: '#333333',
        ring: '#333333',
        sidebar: '#333333',
        sidebarForeground: '#383838',
      },
    }

    useThemeManager.getState().importTheme(JSON.stringify(lowContrastTheme))
    render(<ThemeManagerSection />)

    expect(screen.getByText(/low contrast ratio/i)).toBeInTheDocument()
  })

  it('resets theme to default when reset button is clicked', () => {
    useThemeManager.getState().selectTheme('dracula')
    render(<ThemeManagerSection />)

    const resetBtn = screen.getByRole('button', { name: /reset to default/i })
    fireEvent.click(resetBtn)

    expect(useThemeManager.getState().activeThemeId).toBe('default')
  })
})
