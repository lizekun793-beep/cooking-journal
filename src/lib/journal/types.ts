import type { BgChoice, CustomBg, Recipe } from '../../types'

export interface JournalState {
  recipes: Recipe[]
  bg: BgChoice
  customBgs: CustomBg[]
}

export interface SnapshotFile {
  schemaVersion: number
  savedAt?: string
  recipes: Recipe[]
  bg: BgChoice
  customBgs: CustomBg[]
}

export interface BackupFile extends SnapshotFile {
  kind: string
  exportedAt: string
}

export type ValidateOk<T> = { ok: true; data: T }
export type ValidateFail = { ok: false; error: string }
export type ValidateResult<T> = ValidateOk<T> | ValidateFail

export type RecoverSource = 'current' | 'previous' | 'none'

export type RecoverResult =
  | { source: 'current' | 'previous'; data: JournalState; currentError?: string }
  | { source: 'none'; currentError?: string; previousError?: string }

export type MigrateResult =
  | { status: 'empty' }
  | { status: 'malformed'; error: string }
  | { status: 'ok'; data: JournalState; keysPresent: string[] }

export type HydrateSource = 'current' | 'previous' | 'legacy' | 'seed' | 'blocked-malformed'

export interface HydrateResult {
  state: JournalState
  source: HydrateSource
  persistBlocked: boolean
  warning?: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export interface FileStore {
  /** UTF-8 file text, or null only when the path is verified missing. */
  readUtf8(path: string): Promise<string | null>
  writeUtf8(path: string, data: string): Promise<void>
  copy(from: string, to: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
}
