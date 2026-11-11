import { describe, expect, it } from 'vitest'
import { exportThemeToFile, parseThemeFileContent } from './theme-parser'

describe('theme-parser', () => {
  const sampleMotrixJson = JSON.stringify({
    id: 'custom-ocean',
    name: 'Ocean Breeze',
    variant: 'dark',
    colors: {
      background: '#0a192f',
      foreground: '#ccd6f6',
      card: '#112240',
      cardForeground: '#ccd6f6',
      popover: '#112240',
      popoverForeground: '#ccd6f6',
      primary: '#64ffda',
      primaryForeground: '#0a192f',
      secondary: '#233554',
      secondaryForeground: '#ccd6f6',
      muted: '#233554',
      mutedForeground: '#8892b0',
      accent: '#64ffda',
      accentForeground: '#0a192f',
      destructive: '#ff5555',
      border: '#233554',
      input: '#233554',
      ring: '#64ffda',
      sidebar: '#020c1b',
      sidebarForeground: '#ccd6f6',
    },
  })

  const sampleBase16Yaml = `
scheme: "Solarized Dark"
author: "Ethan Schoonover"
base00: "002b36"
base01: "073642"
base02: "586e75"
base03: "657b83"
base04: "839496"
base05: "93a1a1"
base06: "eee8d5"
base07: "fdf6e3"
base08: "dc322f"
base09: "cb4b16"
base0A: "b58900"
base0B: "859900"
base0C: "2aa198"
base0D: "268bd2"
base0E: "6c71c4"
base0F: "d33682"
`

  it('parses direct Motrix Theme JSON', () => {
    const res = parseThemeFileContent(sampleMotrixJson)
    expect(res.sourceFormat).toBe('motrix-json')
    expect(res.theme.name).toBe('Ocean Breeze')
    expect(res.theme.colors.primary).toBe('#64ffda')
  })

  it('parses Base16 YAML scheme', () => {
    const res = parseThemeFileContent(sampleBase16Yaml)
    expect(res.sourceFormat).toBe('base16-yaml')
    expect(res.theme.name).toBe('Solarized Dark')
    expect(res.theme.variant).toBe('dark')
    expect(res.theme.colors.background).toBe('#002b36')
    expect(res.theme.colors.primary).toBe('#268bd2')
  })

  it('parses Base16 JSON scheme', () => {
    const base16Json = JSON.stringify({
      scheme: 'Gruvbox Dark',
      author: 'morhetz',
      base00: '282828',
      base01: '3c3836',
      base02: '504945',
      base03: '665c54',
      base04: 'bdae93',
      base05: 'd5c4a1',
      base06: 'ebdbb2',
      base07: 'fbf1c7',
      base08: 'fb4934',
      base09: 'fe8019',
      base0A: 'fabd2f',
      base0B: 'b8bb26',
      base0C: '8ec07c',
      base0D: '83a598',
      base0E: 'd3869b',
      base0F: 'd65d0e',
    })

    const res = parseThemeFileContent(base16Json)
    expect(res.sourceFormat).toBe('base16-json')
    expect(res.theme.name).toBe('Gruvbox Dark')
    expect(res.theme.colors.background).toBe('#282828')
  })

  it('throws descriptive error on malformed content', () => {
    expect(() =>
      parseThemeFileContent('This is completely invalid', 'bad.txt')
    ).toThrow(/Invalid theme format for file "bad.txt"/)
    expect(() => parseThemeFileContent('')).toThrow(/Theme file is empty/)
  })

  it('exports theme to JSON and Base16 files', () => {
    const { theme } = parseThemeFileContent(sampleMotrixJson)
    const jsonExport = exportThemeToFile(theme, 'json')
    expect(jsonExport.filename).toBe('custom-ocean.motrix-theme.json')
    expect(JSON.parse(jsonExport.content).name).toBe('Ocean Breeze')

    const base16Export = exportThemeToFile(theme, 'base16')
    expect(base16Export.filename).toBe('custom-ocean.base16.json')
    const parsedBase16 = JSON.parse(base16Export.content)
    expect(parsedBase16.scheme).toBe('Ocean Breeze')
    expect(parsedBase16.base00).toBeDefined()
  })
})
