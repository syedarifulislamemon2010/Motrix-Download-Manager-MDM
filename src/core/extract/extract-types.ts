export type ArchiveType = 'zip' | 'sevenZip' | 'rar' | 'unknown'

export interface ExtractOptions {
  destinationDir?: string
  password?: string
  deleteArchiveAfterExtract?: boolean
}

export interface ExtractResult {
  success: boolean
  archivePath: string
  destinationDir: string
  filesExtracted: number
  totalBytes: number
  error?: string
}

export interface ArchiveExtractor {
  canHandle(type: ArchiveType): boolean
  extract(
    archivePath: string,
    destinationDir: string,
    options?: ExtractOptions
  ): Promise<ExtractResult>
}
