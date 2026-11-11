import path from 'node:path'
import type {
  HelperBinaryCandidate,
  HelperBinaryCandidateKind,
  HelperBinaryDetection,
  HelperBinaryId,
  HelperPlatform,
} from '@shared/schemas/helper-binary'
import { type BinaryProbeResult, probeBinary } from './binary-probe'

export interface HelperBinaryLocatorInput {
  manualPath?: string
  userDataDir: string
  env?: Record<string, string | undefined>
  platform?: HelperPlatform
  resolveExecutable?: (candidate: string) => Promise<string | null>
}

export function defaultBinaryName(
  id: HelperBinaryId,
  platform: HelperPlatform
): string {
  const isWindows = platform === 'win32'
  switch (id) {
    case 'yt-dlp':
      return isWindows ? 'yt-dlp.exe' : 'yt-dlp'
    case 'gallery-dl':
      return isWindows ? 'gallery-dl.exe' : 'gallery-dl'
    case 'deno':
      return isWindows ? 'deno.exe' : 'deno'
  }
}

export function defaultEnvVar(id: HelperBinaryId): string {
  switch (id) {
    case 'yt-dlp':
      return 'MOTRIX_YTDLP_BIN'
    case 'gallery-dl':
      return 'MOTRIX_GALLERYDL_BIN'
    case 'deno':
      return 'MOTRIX_DENO_BIN'
  }
}

export async function locateHelperBinary(
  id: HelperBinaryId,
  input: HelperBinaryLocatorInput,
  probe: (candidatePath: string) => Promise<BinaryProbeResult> = probeBinary
): Promise<HelperBinaryDetection> {
  const platform = input.platform ?? (process.platform as HelperPlatform)
  const env = input.env ?? process.env
  const binaryName = defaultBinaryName(id, platform)

  const candidateSpecs: Array<{
    kind: HelperBinaryCandidateKind
    path: string | null
  }> = [
    {
      kind: 'manual',
      path:
        input.manualPath && input.manualPath.trim().length > 0
          ? input.manualPath.trim()
          : null,
    },
    {
      kind: 'userData',
      path: path.join(input.userDataDir, 'binaries', id, binaryName),
    },
    {
      kind: 'env',
      path: env[defaultEnvVar(id)]?.trim() || null,
    },
    {
      kind: 'path',
      path: binaryName,
    },
  ]

  const candidates: HelperBinaryCandidate[] = []
  let activeWinner: { path: string; version: string } | null = null

  for (const spec of candidateSpecs) {
    if (!spec.path) {
      candidates.push({
        kind: spec.kind,
        path: null,
        state: 'unconfigured',
      })
      continue
    }

    let resolvedPath = spec.path
    if (spec.kind === 'path' && input.resolveExecutable) {
      const resolved = await input.resolveExecutable(spec.path)
      if (!resolved) {
        candidates.push({
          kind: spec.kind,
          path: spec.path,
          state: 'missing',
        })
        continue
      }
      resolvedPath = resolved
    }

    const probeResult = await probe(resolvedPath)
    if (probeResult.available && probeResult.version) {
      const state = activeWinner === null ? 'active' : 'available'
      if (activeWinner === null) {
        activeWinner = {
          path: resolvedPath,
          version: probeResult.version,
        }
      }
      candidates.push({
        kind: spec.kind,
        path: resolvedPath,
        state,
        version: probeResult.version,
      })
    } else {
      candidates.push({
        kind: spec.kind,
        path: resolvedPath,
        state: 'missing',
      })
    }
  }

  return {
    id,
    active: activeWinner,
    candidates,
  }
}
