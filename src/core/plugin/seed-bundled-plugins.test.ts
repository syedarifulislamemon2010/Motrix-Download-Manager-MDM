import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedBundledPlugins } from './seed-bundled-plugins'

describe('seedBundledPlugins', () => {
  let sourceDir: string
  let targetDir: string

  beforeEach(async () => {
    sourceDir = await mkdtemp(path.join(tmpdir(), 'motrix-seed-src-'))
    targetDir = await mkdtemp(path.join(tmpdir(), 'motrix-seed-tgt-'))
  })

  afterEach(async () => {
    await rm(sourceDir, { recursive: true, force: true })
    await rm(targetDir, { recursive: true, force: true })
  })

  it('gracefully handles missing source directory', async () => {
    const missing = path.join(sourceDir, 'non-existent')
    await expect(seedBundledPlugins(missing, targetDir)).resolves.not.toThrow()
  })

  it('seeds plugins into target directory when not present', async () => {
    const pluginA = path.join(sourceDir, 'community.plugin-a')
    await mkdir(pluginA, { recursive: true })
    await writeFile(
      path.join(pluginA, 'motrix-plugin.json'),
      JSON.stringify({ id: 'community.plugin-a' })
    )
    await writeFile(path.join(pluginA, 'plugin.js'), 'console.log("a")')

    await seedBundledPlugins(sourceDir, targetDir)

    const targetManifest = path.join(
      targetDir,
      'community.plugin-a',
      'motrix-plugin.json'
    )
    expect(existsSync(targetManifest)).toBe(true)
    const content = JSON.parse(await readFile(targetManifest, 'utf8'))
    expect(content.id).toBe('community.plugin-a')
  })

  it('does not overwrite existing target plugin with motrix-plugin.json', async () => {
    const pluginA = path.join(sourceDir, 'community.plugin-a')
    await mkdir(pluginA, { recursive: true })
    await writeFile(
      path.join(pluginA, 'motrix-plugin.json'),
      JSON.stringify({ id: 'community.plugin-a', version: '2.0.0' })
    )

    const targetPluginA = path.join(targetDir, 'community.plugin-a')
    await mkdir(targetPluginA, { recursive: true })
    await writeFile(
      path.join(targetPluginA, 'motrix-plugin.json'),
      JSON.stringify({ id: 'community.plugin-a', version: '1.0.0-user-modified' })
    )

    await seedBundledPlugins(sourceDir, targetDir)

    const targetManifest = path.join(targetPluginA, 'motrix-plugin.json')
    const content = JSON.parse(await readFile(targetManifest, 'utf8'))
    expect(content.version).toBe('1.0.0-user-modified')
  })

  it('skips non-directories and hidden / underscore directories', async () => {
    await writeFile(path.join(sourceDir, 'some-file.txt'), 'hello')
    const hiddenDir = path.join(sourceDir, '.hidden-plugin')
    await mkdir(hiddenDir, { recursive: true })
    await writeFile(path.join(hiddenDir, 'motrix-plugin.json'), '{}')

    const underscoreDir = path.join(sourceDir, '_transient')
    await mkdir(underscoreDir, { recursive: true })
    await writeFile(path.join(underscoreDir, 'motrix-plugin.json'), '{}')

    await seedBundledPlugins(sourceDir, targetDir)

    expect(existsSync(path.join(targetDir, 'some-file.txt'))).toBe(false)
    expect(existsSync(path.join(targetDir, '.hidden-plugin'))).toBe(false)
    expect(existsSync(path.join(targetDir, '_transient'))).toBe(false)
  })
})
