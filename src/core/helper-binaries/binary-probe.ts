import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface BinaryProbeResult {
  available: boolean
  binaryPath?: string
  version?: string
}

/**
 * Probe a candidate executable binary by spawning `<binaryPath> --version`.
 * Hard timeout: 5 seconds.
 */
export function probeBinary(binaryPath: string): Promise<BinaryProbeResult> {
  const isPathLike = binaryPath.includes('/') || binaryPath.includes('\\')
  if (isPathLike && !existsSync(binaryPath)) {
    return Promise.resolve({ available: false })
  }

  return new Promise<BinaryProbeResult>((resolve) => {
    let settled = false
    const settle = (result: BinaryProbeResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let ch: ReturnType<typeof spawn>
    try {
      ch = spawn(binaryPath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      settle({ available: false })
      return
    }

    const timer = setTimeout(() => {
      try {
        ch.kill('SIGTERM')
      } catch {
        // ignore
      }
      settle({ available: false })
    }, 5_000)

    let stdout = ''
    ch.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    ch.on('error', () => {
      clearTimeout(timer)
      settle({ available: false })
    })

    ch.on('close', (code: number | null) => {
      clearTimeout(timer)
      if (code !== 0 && code !== null) {
        settle({ available: false })
        return
      }

      // Parse first line of output or first semver/date-version match
      const lines = stdout.trim().split(/\r?\n/)
      const firstLine = lines[0] ?? ''
      const match =
        firstLine.match(
          /\b(\d{4}\.\d{2}\.\d{2}|\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\b/
        ) ?? firstLine.match(/([a-zA-Z0-9._-]+)/)

      const version = match ? match[1] : firstLine.slice(0, 32)
      settle({
        available: true,
        binaryPath,
        version: version || 'detected',
      })
    })
  })
}
