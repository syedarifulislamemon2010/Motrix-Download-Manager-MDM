import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { getLogger } from '@core/logger'

const log = getLogger('plugin:seed')

/**
 * Seeds bundled community plugins into the active user plugins directory
 * on startup if they have not yet been installed/seeded there.
 */
export async function seedBundledPlugins(
  seedSourceDir: string,
  targetPluginsDir: string
): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(seedSourceDir)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return
    log.warn(
      { err, seedSourceDir },
      'unable to read bundled plugins seed directory'
    )
    return
  }

  for (const name of entries) {
    if (name.startsWith('.') || name.startsWith('_')) continue
    const sourcePath = path.join(seedSourceDir, name)
    const targetPath = path.join(targetPluginsDir, name)

    try {
      const s = await stat(sourcePath)
      if (!s.isDirectory()) continue

      let targetExists = false
      try {
        await stat(path.join(targetPath, 'motrix-plugin.json'))
        targetExists = true
      } catch {
        targetExists = false
      }

      if (!targetExists) {
        log.info(
          { pluginId: name, targetPath },
          'seeding bundled plugin to user plugins directory'
        )
        await mkdir(targetPath, { recursive: true })
        await cp(sourcePath, targetPath, { recursive: true })
      }
    } catch (err) {
      log.warn({ err, pluginId: name }, 'failed to seed bundled plugin')
    }
  }
}
