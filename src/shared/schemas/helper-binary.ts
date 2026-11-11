import { z } from 'zod'

export const HELPER_BINARY_IDS = ['yt-dlp', 'gallery-dl', 'deno'] as const
export type HelperBinaryId = (typeof HELPER_BINARY_IDS)[number]

export const helperBinaryIdSchema = z.enum(['yt-dlp', 'gallery-dl', 'deno'])

export const helperPlatformSchema = z.enum(['win32', 'darwin', 'linux'])
export type HelperPlatform = z.infer<typeof helperPlatformSchema>

export const helperArchSchema = z.enum(['x64', 'arm64'])
export type HelperArch = z.infer<typeof helperArchSchema>

export interface HelperBinaryTargetSpec {
  assetName: string
  binaryName: string
  url: string
  sha256: string
  isArchive?: boolean
}

export interface HelperBinaryReleaseManifest {
  id: HelperBinaryId
  displayName: string
  releaseVersion: string
  targets: Partial<
    Record<`${HelperPlatform}-${HelperArch}`, HelperBinaryTargetSpec>
  >
}

export const HELPER_BINARY_MANIFESTS: Record<
  HelperBinaryId,
  HelperBinaryReleaseManifest
> = {
  'yt-dlp': {
    id: 'yt-dlp',
    displayName: 'yt-dlp',
    releaseVersion: '2025.02.19',
    targets: {
      'win32-x64': {
        assetName: 'yt-dlp.exe',
        binaryName: 'yt-dlp.exe',
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2025.02.19/yt-dlp.exe',
        sha256:
          '65bb03dfaa5cbf239f1c7d3dbefaa58a8a3a0e695d7eb661ebff66b03ebdfeb7',
      },
      'linux-x64': {
        assetName: 'yt-dlp_linux',
        binaryName: 'yt-dlp',
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2025.02.19/yt-dlp_linux',
        sha256:
          'a93ca373cce4ebbfeb340ec5a1b32bb3f837346fa01c4c1a5ca663be8471e9a3',
      },
      'darwin-x64': {
        assetName: 'yt-dlp_macos',
        binaryName: 'yt-dlp',
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2025.02.19/yt-dlp_macos',
        sha256:
          '3bfe92a6aa2e70392f7e7a5c86fc0424b3337947137f8eb28a07c13284aa40c6',
      },
      'darwin-arm64': {
        assetName: 'yt-dlp_macos',
        binaryName: 'yt-dlp',
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2025.02.19/yt-dlp_macos',
        sha256:
          '3bfe92a6aa2e70392f7e7a5c86fc0424b3337947137f8eb28a07c13284aa40c6',
      },
    },
  },
  'gallery-dl': {
    id: 'gallery-dl',
    displayName: 'gallery-dl',
    releaseVersion: '1.28.5',
    targets: {
      'win32-x64': {
        assetName: 'gallery-dl.exe',
        binaryName: 'gallery-dl.exe',
        url: 'https://github.com/mikf/gallery-dl/releases/download/v1.28.5/gallery-dl.exe',
        sha256:
          'c11e74f4b23269a8b65672cb76d8b671a5330e7fc972b25ef14e13e4b78c5ce9',
      },
      'linux-x64': {
        assetName: 'gallery-dl.bin',
        binaryName: 'gallery-dl',
        url: 'https://github.com/mikf/gallery-dl/releases/download/v1.28.5/gallery-dl.bin',
        sha256:
          'f14a87265ea97e1634b3f81e33814ca5368a623069c9b5a8e0cb20e3a6ea237a',
      },
      'darwin-x64': {
        assetName: 'gallery-dl.bin',
        binaryName: 'gallery-dl',
        url: 'https://github.com/mikf/gallery-dl/releases/download/v1.28.5/gallery-dl.bin',
        sha256:
          'f14a87265ea97e1634b3f81e33814ca5368a623069c9b5a8e0cb20e3a6ea237a',
      },
      'darwin-arm64': {
        assetName: 'gallery-dl.bin',
        binaryName: 'gallery-dl',
        url: 'https://github.com/mikf/gallery-dl/releases/download/v1.28.5/gallery-dl.bin',
        sha256:
          'f14a87265ea97e1634b3f81e33814ca5368a623069c9b5a8e0cb20e3a6ea237a',
      },
    },
  },
  deno: {
    id: 'deno',
    displayName: 'Deno Runtime',
    releaseVersion: 'v2.2.0',
    targets: {
      'win32-x64': {
        assetName: 'deno-x86_64-pc-windows-msvc.zip',
        binaryName: 'deno.exe',
        url: 'https://github.com/denoland/deno/releases/download/v2.2.0/deno-x86_64-pc-windows-msvc.zip',
        sha256:
          'e0d6b99fe1efb0d774fcf1221b6a12aa440e1189d2be0d769062ecda642e2a14',
        isArchive: true,
      },
      'linux-x64': {
        assetName: 'deno-x86_64-unknown-linux-gnu.zip',
        binaryName: 'deno',
        url: 'https://github.com/denoland/deno/releases/download/v2.2.0/deno-x86_64-unknown-linux-gnu.zip',
        sha256:
          '2d43e5c9b83b16d5668b8ecbcf5962b9a7b931dcba33b3b3a6efba99bda6ce47',
        isArchive: true,
      },
      'darwin-arm64': {
        assetName: 'deno-aarch64-apple-darwin.zip',
        binaryName: 'deno',
        url: 'https://github.com/denoland/deno/releases/download/v2.2.0/deno-aarch64-apple-darwin.zip',
        sha256:
          '1356ce0f4f910606f23347b7aaebdb1c620406df7ea669076bf1566373b9d885',
        isArchive: true,
      },
      'darwin-x64': {
        assetName: 'deno-x86_64-apple-darwin.zip',
        binaryName: 'deno',
        url: 'https://github.com/denoland/deno/releases/download/v2.2.0/deno-x86_64-apple-darwin.zip',
        sha256:
          '63162799307d9bbdae9ee574e49339e60ea9ef5722f4625fa5019d17d121ba57',
        isArchive: true,
      },
    },
  },
}

export const helperBinaryCandidateKindSchema = z.enum([
  'manual',
  'userData',
  'env',
  'path',
])
export type HelperBinaryCandidateKind = z.infer<
  typeof helperBinaryCandidateKindSchema
>

export const helperBinaryCandidateStateSchema = z.enum([
  'active',
  'available',
  'missing',
  'untrusted',
  'verification_unavailable',
  'unconfigured',
])
export type HelperBinaryCandidateState = z.infer<
  typeof helperBinaryCandidateStateSchema
>

export const helperBinaryCandidateSchema = z.object({
  kind: helperBinaryCandidateKindSchema,
  path: z.string().nullable(),
  state: helperBinaryCandidateStateSchema,
  version: z.string().optional(),
})
export type HelperBinaryCandidate = z.infer<typeof helperBinaryCandidateSchema>

export const helperBinaryDetectionSchema = z.object({
  id: helperBinaryIdSchema,
  active: z
    .object({
      path: z.string(),
      version: z.string(),
    })
    .nullable(),
  candidates: z.array(helperBinaryCandidateSchema),
})
export type HelperBinaryDetection = z.infer<typeof helperBinaryDetectionSchema>

export const helperBinaryInstallPhaseSchema = z.enum([
  'idle',
  'downloading',
  'verifying',
  'extracting',
  'installed',
  'error',
])
export type HelperBinaryInstallPhase = z.infer<
  typeof helperBinaryInstallPhaseSchema
>

export const helperBinaryInstallStatusSchema = z.object({
  id: helperBinaryIdSchema,
  phase: helperBinaryInstallPhaseSchema,
  bytesReceived: z.number().int().nonnegative(),
  bytesTotal: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100).nullable(),
  version: z.string().nullable(),
  directory: z.string().nullable(),
  error: z.string().nullable(),
})
export type HelperBinaryInstallStatus = z.infer<
  typeof helperBinaryInstallStatusSchema
>

export const helperBinaryInstallResultSchema = z.object({
  ok: z.boolean(),
  id: helperBinaryIdSchema,
  version: z.string().optional(),
  error: z.string().optional(),
})
export type HelperBinaryInstallResult = z.infer<
  typeof helperBinaryInstallResultSchema
>
