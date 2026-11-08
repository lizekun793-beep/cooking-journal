import type { Recipe } from '../../types'
import {
  NATIVE_RESTORE_PATH,
  NATIVE_SNAPSHOT_PATH,
  NATIVE_SNAPSHOT_PREV_PATH,
  NATIVE_SNAPSHOT_STAGING_PATH,
  WEB_RESTORE_KEY,
  WEB_SNAPSHOT_KEY,
  WEB_SNAPSHOT_PREV_KEY,
} from './keys'
import { migrateFromLocalStorage, writeLegacyKeys } from './migrate'
import { recoverSnapshot } from './recovery'
import type {
  FileStore,
  HydrateResult,
  JournalState,
  StorageLike,
  ValidateResult,
} from './types'
import { backupToJson, parseBackup, parseSnapshot, snapshotToJson } from './validate'

type SnapshotSlot =
  | { status: 'missing' }
  | { status: 'present'; raw: string }
  | { status: 'error'; error: string }

export interface JournalStoreDeps {
  isNative: boolean
  files?: FileStore
  webStorage?: StorageLike
  seed: () => Recipe[]
  now?: () => Date
}

function iso(now: () => Date): string {
  return now().toISOString()
}

function cloneState(state: JournalState): JournalState {
  return {
    recipes: state.recipes.map((r) => ({ ...r, photos: [...r.photos], pits: [...r.pits], tags: r.tags.map((t) => ({ ...t })) })),
    bg: state.bg,
    customBgs: state.customBgs.map((b) => ({ ...b })),
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export class JournalStore {
  private hydratePromise: Promise<HydrateResult> | null = null
  private result: HydrateResult | null = null
  private writeChain: Promise<void> = Promise.resolve()
  private readonly now: () => Date

  constructor(private readonly deps: JournalStoreDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  hydrate(): Promise<HydrateResult> {
    if (!this.hydratePromise) {
      this.hydratePromise = this.doHydrate().then((result) => {
        this.result = result
        return result
      })
    }
    return this.hydratePromise
  }

  async save(state: JournalState): Promise<void> {
    const hydrated = await this.hydrate()
    if (hydrated.persistBlocked) {
      throw new Error('现有手帐无法安全读取，已停止写入以免覆盖。请先导入备份。')
    }
    await this.enqueue(() => this.writeState(state, { recoveryCopy: false }))
    this.touchState(state, hydrated.source, false, hydrated.warning)
  }

  async exportBackupJson(): Promise<string> {
    const hydrated = await this.hydrate()
    return backupToJson(hydrated.state, iso(this.now))
  }

  async importBackup(raw: string, confirmed: boolean): Promise<ValidateResult<JournalState>> {
    if (!confirmed) {
      return { ok: false, error: '需要确认后才能导入。' }
    }
    const parsed = parseBackup(raw)
    if (!parsed.ok) return parsed
    await this.hydrate()
    const incoming: JournalState = {
      recipes: parsed.data.recipes,
      bg: parsed.data.bg,
      customBgs: parsed.data.customBgs,
    }
    try {
      await this.enqueue(() => this.writeState(incoming, { recoveryCopy: true }))
    } catch (err) {
      return { ok: false, error: errorMessage(err, '导入时保存失败，现有手帐未改动。') }
    }
    this.touchState(incoming, 'current', false, undefined)
    return { ok: true, data: cloneState(incoming) }
  }

  getSnapshot(): JournalState | null {
    return this.result ? cloneState(this.result.state) : null
  }

  private touchState(
    state: JournalState,
    source: HydrateResult['source'],
    persistBlocked: boolean,
    warning?: string,
  ): void {
    this.result = {
      state: cloneState(state),
      source,
      persistBlocked,
      warning,
    }
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const run = this.writeChain.then(fn, fn)
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async doHydrate(): Promise<HydrateResult> {
    if (this.deps.isNative) {
      return this.hydrateNative()
    }
    return this.hydrateWeb()
  }

  private async readSlot(files: FileStore, path: string): Promise<SnapshotSlot> {
    try {
      const raw = await files.readUtf8(path)
      if (raw == null) return { status: 'missing' }
      return { status: 'present', raw }
    } catch (err) {
      return { status: 'error', error: errorMessage(err, '本地快照无法读取。') }
    }
  }

  private slotRaw(slot: SnapshotSlot): string | null {
    return slot.status === 'present' ? slot.raw : null
  }

  private blocked(state: JournalState, source: HydrateResult['source'], warning: string): HydrateResult {
    return {
      state: cloneState(state),
      source,
      persistBlocked: true,
      warning,
    }
  }

  private async hydrateNative(): Promise<HydrateResult> {
    const files = this.deps.files
    if (!files) {
      return this.blocked(
        { recipes: [], bg: 'default', customBgs: [] },
        'blocked-malformed',
        '无法使用本地文件存储。为避免覆盖，没有写入新数据。请导入备份。',
      )
    }

    const current = await this.readSlot(files, NATIVE_SNAPSHOT_PATH)
    const previous = await this.readSlot(files, NATIVE_SNAPSHOT_PREV_PATH)

    if (current.status === 'error' || (previous.status === 'error' && current.status !== 'present')) {
      const recovered = recoverSnapshot(this.slotRaw(current), this.slotRaw(previous))
      const state =
        recovered.source === 'none'
          ? { recipes: [], bg: 'default' as const, customBgs: [] }
          : recovered.data
      const details = [
        current.status === 'error' ? current.error : '',
        previous.status === 'error' ? previous.error : '',
      ]
        .filter(Boolean)
        .join(' ')
      return this.blocked(
        state,
        recovered.source === 'none' ? 'blocked-malformed' : recovered.source,
        `${details} 为避免覆盖，没有写入新数据。请导入备份。`,
      )
    }

    const currentRaw = this.slotRaw(current)
    const prevRaw = this.slotRaw(previous)
    const recovered = recoverSnapshot(currentRaw, prevRaw)
    if (recovered.source !== 'none') {
      if (recovered.source === 'previous') {
        try {
          await this.writeNative(files, recovered.data, { recoveryCopy: false })
        } catch {
          /* keep serving recovered data even if repair write fails */
        }
      }
      return {
        state: cloneState(recovered.data),
        source: recovered.source,
        persistBlocked: false,
        warning: recovered.currentError
          ? '当前快照损坏，已从上一份恢复副本读回。'
          : undefined,
      }
    }

    const unreadableSnapshot =
      (currentRaw != null && currentRaw.trim() !== '') ||
      (prevRaw != null && prevRaw.trim() !== '')
    if (unreadableSnapshot) {
      return this.blocked(
        { recipes: [], bg: 'default', customBgs: [] },
        'blocked-malformed',
        `${recovered.currentError || recovered.previousError || '本地快照无法读取。'} 为避免覆盖，没有写入新数据。请导入备份。`,
      )
    }

    const migrated = migrateFromLocalStorage(this.deps.webStorage)
    if (migrated.status === 'ok') {
      try {
        await this.writeNative(files, migrated.data, { recoveryCopy: false })
      } catch (err) {
        return {
          state: cloneState(migrated.data),
          source: 'legacy',
          persistBlocked: false,
          warning: `已读到网页版本地记录，但未能写入应用文件（${errorMessage(err, '保存失败')}）。原键未删除，尚未完成迁移。`,
        }
      }
      return {
        state: cloneState(migrated.data),
        source: 'legacy',
        persistBlocked: false,
        warning: '已从网页版本地记录迁到应用文件，原键未删除。',
      }
    }
    if (migrated.status === 'malformed') {
      return this.blocked(
        { recipes: [], bg: 'default', customBgs: [] },
        'blocked-malformed',
        `${migrated.error} 为避免覆盖，没有写入新数据。请导入备份。`,
      )
    }

    return this.persistSeed(files)
  }

  private async hydrateWeb(): Promise<HydrateResult> {
    const storage = this.deps.webStorage
    if (!storage) return this.fromSeed()

    const currentRaw = storage.getItem(WEB_SNAPSHOT_KEY)
    const prevRaw = storage.getItem(WEB_SNAPSHOT_PREV_KEY)
    const recovered = recoverSnapshot(currentRaw, prevRaw)
    if (recovered.source !== 'none') {
      if (recovered.source === 'previous') {
        try {
          storage.setItem(WEB_SNAPSHOT_KEY, snapshotToJson(recovered.data, iso(this.now)))
        } catch {
          /* quota */
        }
      }
      return {
        state: cloneState(recovered.data),
        source: recovered.source,
        persistBlocked: false,
        warning: recovered.currentError
          ? '当前快照损坏，已从上一份恢复副本读回。'
          : undefined,
      }
    }

    const unreadableSnapshot =
      (currentRaw != null && currentRaw.trim() !== '') ||
      (prevRaw != null && prevRaw.trim() !== '')
    if (unreadableSnapshot) {
      return {
        state: { recipes: [], bg: 'default', customBgs: [] },
        source: 'blocked-malformed',
        persistBlocked: true,
        warning: `${recovered.currentError || recovered.previousError || '本地快照无法读取。'} 为避免覆盖，没有写入新数据。请导入备份。`,
      }
    }

    const migrated = migrateFromLocalStorage(storage)
    if (migrated.status === 'ok') {
      try {
        this.writeWebSnapshot(storage, migrated.data, false)
      } catch {
        /* keep serving migrated in-memory data */
      }
      return {
        state: cloneState(migrated.data),
        source: 'legacy',
        persistBlocked: false,
      }
    }
    if (migrated.status === 'malformed') {
      return {
        state: { recipes: [], bg: 'default', customBgs: [] },
        source: 'blocked-malformed',
        persistBlocked: true,
        warning: `${migrated.error} 为避免覆盖，没有写入新数据。请导入备份。`,
      }
    }

    const seed = this.seedState()
    try {
      this.writeWebSnapshot(storage, seed, false)
      writeLegacyKeys(storage, seed)
    } catch {
      /* first-run seed stays in memory */
    }
    return { state: seed, source: 'seed', persistBlocked: false }
  }

  private seedState(): JournalState {
    return { recipes: this.deps.seed(), bg: 'default', customBgs: [] }
  }

  private fromSeed(warning?: string): HydrateResult {
    return { state: this.seedState(), source: 'seed', persistBlocked: false, warning }
  }

  private async persistSeed(files: FileStore): Promise<HydrateResult> {
    const seed = this.seedState()
    try {
      await this.writeNative(files, seed, { recoveryCopy: false })
    } catch {
      return { state: seed, source: 'seed', persistBlocked: false, warning: '首次保存示例手帐失败，仍可继续编辑。' }
    }
    return { state: seed, source: 'seed', persistBlocked: false }
  }

  private async writeState(state: JournalState, opts: { recoveryCopy: boolean }): Promise<void> {
    if (this.deps.isNative) {
      const files = this.deps.files
      if (!files) throw new Error('没有可用的文件存储。')
      await this.writeNative(files, state, opts)
      return
    }
    const storage = this.deps.webStorage
    if (!storage) throw new Error('没有可用的浏览器存储。')
    this.writeWebSnapshot(storage, state, opts.recoveryCopy)
    writeLegacyKeys(storage, state)
  }

  private async writeNative(
    files: FileStore,
    state: JournalState,
    opts: { recoveryCopy: boolean },
  ): Promise<void> {
    const json = snapshotToJson(state, iso(this.now))
    const staging = NATIVE_SNAPSHOT_STAGING_PATH

    await files.writeUtf8(staging, json)
    const staged = await files.readUtf8(staging)
    if (staged == null) {
      throw new Error('暂存快照写入后找不到，未改动当前手帐。')
    }
    const parsed = parseSnapshot(staged)
    if (!parsed.ok) {
      throw new Error('暂存快照校验失败，未改动当前手帐。')
    }

    let current: string | null
    try {
      current = await files.readUtf8(NATIVE_SNAPSHOT_PATH)
    } catch (err) {
      throw new Error(errorMessage(err, '读取当前快照失败，未改动当前手帐。'))
    }
    const currentOk =
      current != null && current.trim() !== '' && recoverSnapshot(current, null).source === 'current'

    if (opts.recoveryCopy && current != null && current.trim() !== '') {
      await files.writeUtf8(NATIVE_RESTORE_PATH, current)
    }

    if (currentOk) {
      await files.copy(NATIVE_SNAPSHOT_PATH, NATIVE_SNAPSHOT_PREV_PATH)
    }

    await this.replaceWithStaging(files, staging, NATIVE_SNAPSHOT_PATH)
  }

  private async replaceWithStaging(files: FileStore, stagingPath: string, destPath: string): Promise<void> {
    try {
      await files.rename(stagingPath, destPath)
      return
    } catch {
      /* destination may already exist; displace it then retry */
    }
    const displaced = `${destPath}.old`
    let movedDest = false
    try {
      await files.rename(destPath, displaced)
      movedDest = true
    } catch {
      await files.rename(stagingPath, destPath)
      return
    }
    try {
      await files.rename(stagingPath, destPath)
    } catch (err) {
      if (movedDest) {
        try {
          await files.rename(displaced, destPath)
        } catch {
          /* previous snapshot still holds the last valid copy */
        }
      }
      throw err
    }
    try {
      await files.remove(displaced)
    } catch {
      /* leftover .old is harmless */
    }
  }

  private writeWebSnapshot(storage: StorageLike, state: JournalState, recoveryCopy: boolean): void {
    const json = snapshotToJson(state, iso(this.now))
    const current = storage.getItem(WEB_SNAPSHOT_KEY)
    const currentOk = current != null && recoverSnapshot(current, null).source === 'current'
    if (recoveryCopy && current != null) {
      storage.setItem(WEB_RESTORE_KEY, current)
    }
    if (currentOk) {
      storage.setItem(WEB_SNAPSHOT_PREV_KEY, current)
    }
    storage.setItem(WEB_SNAPSHOT_KEY, json)
  }
}
