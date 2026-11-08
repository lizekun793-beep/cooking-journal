import type { BgChoice, CustomBg, InkKind, InkTag, Recipe } from '../../types'
import { BACKUP_KIND, SCHEMA_VERSION } from './keys'
import { isAllowedImageSrc, sanitizeImageList } from './images'
import type { BackupFile, JournalState, SnapshotFile, ValidateResult } from './types'

const INK_KINDS = new Set<InkKind>(['ok', 'pit', 'plain'])

export interface ValidateOptions {
  /** Import/backup: reject the whole payload if any image URL is disallowed. */
  images: 'reject' | 'strip'
  /** Backup files must include kind + schemaVersion. Snapshots may omit kind. */
  requireKind?: boolean
  requireSchemaVersion?: boolean
}

function fail(error: string): ValidateResult<never> {
  return { ok: false, error }
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return null
  return input as Record<string, unknown>
}

function parseJsonObject(raw: unknown): ValidateResult<Record<string, unknown>> {
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return fail('内容是空的。')
    try {
      return parseJsonObject(JSON.parse(text) as unknown)
    } catch {
      return fail('不是有效的 JSON。')
    }
  }
  const rec = asRecord(raw)
  if (!rec) return fail('数据不是对象。')
  return { ok: true, data: rec }
}

function readString(value: unknown, fallback?: string): string | null {
  if (typeof value === 'string') return value
  if (fallback !== undefined && value === undefined) return fallback
  return null
}

function readBool(value: unknown, fallback?: boolean): boolean | null {
  if (typeof value === 'boolean') return value
  if (fallback !== undefined && value === undefined) return fallback
  return null
}

function readNumber(value: unknown, fallback?: number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (fallback !== undefined && value === undefined) return fallback
  return null
}

function readTag(value: unknown, strip: boolean): InkTag | null {
  const rec = asRecord(value)
  if (!rec) return null
  const label = readString(rec.label)
  if (!label) return null
  const kindRaw = rec.kind
  if (typeof kindRaw === 'string' && INK_KINDS.has(kindRaw as InkKind)) {
    return { label, kind: kindRaw as InkKind }
  }
  if (strip && (kindRaw === undefined || typeof kindRaw === 'string')) {
    return { label, kind: 'plain' }
  }
  return null
}

function readRecipe(value: unknown, opts: ValidateOptions): ValidateResult<Recipe> {
  const rec = asRecord(value)
  if (!rec) return fail('菜谱格式不对。')
  const id = readString(rec.id)
  const name = readString(rec.name)
  if (!id || !name) return fail('菜谱缺少编号或名称。')
  if (!Array.isArray(rec.photos)) return fail(`菜谱「${name}」的照片列表无效。`)

  if (opts.images === 'reject') {
    for (const src of rec.photos) {
      if (typeof src !== 'string' || !isAllowedImageSrc(src)) {
        return fail(`菜谱「${name}」含有不允许的图片地址。`)
      }
    }
  }

  const photos =
    opts.images === 'strip' ? sanitizeImageList(rec.photos) : (rec.photos as string[])

  const duration = readString(rec.duration, opts.images === 'strip' ? '' : undefined)
  const cookedAt = readString(rec.cookedAt, opts.images === 'strip' ? '' : undefined)
  const method = readString(rec.method, opts.images === 'strip' ? '' : undefined)
  const timesCooked = readNumber(rec.timesCooked, opts.images === 'strip' ? 1 : undefined)
  const createdAt = readString(rec.createdAt, opts.images === 'strip' ? '' : undefined)
  const updatedAt = readString(rec.updatedAt, opts.images === 'strip' ? '' : undefined)
  const isDraft = readBool(rec.isDraft, opts.images === 'strip' ? false : undefined)
  const isSignature = readBool(rec.isSignature, opts.images === 'strip' ? false : undefined)
  const toRetry = readBool(rec.toRetry, opts.images === 'strip' ? false : undefined)
  const shared = readBool(rec.shared, opts.images === 'strip' ? false : undefined)
  const loved = readBool(rec.loved, opts.images === 'strip' ? false : undefined)

  if (
    duration == null ||
    cookedAt == null ||
    method == null ||
    timesCooked == null ||
    createdAt == null ||
    updatedAt == null ||
    isDraft == null ||
    isSignature == null ||
    toRetry == null ||
    shared == null ||
    loved == null
  ) {
    return fail(`菜谱「${name}」字段不完整。`)
  }

  if (!Array.isArray(rec.pits) || rec.pits.some((p) => typeof p !== 'string')) {
    if (opts.images === 'strip' && rec.pits === undefined) {
      /* hydrate default */
    } else {
      return fail(`菜谱「${name}」的踩坑列表无效。`)
    }
  }
  const pits = Array.isArray(rec.pits) ? rec.pits.filter((p): p is string => typeof p === 'string') : []

  if (rec.tags !== undefined && !Array.isArray(rec.tags)) {
    return fail(`菜谱「${name}」的标签无效。`)
  }
  const tags: InkTag[] = []
  for (const item of Array.isArray(rec.tags) ? rec.tags : []) {
    const tag = readTag(item, opts.images === 'strip')
    if (!tag) {
      if (opts.images === 'reject') return fail(`菜谱「${name}」的标签无效。`)
      continue
    }
    tags.push(tag)
  }

  return {
    ok: true,
    data: {
      id,
      name,
      photos,
      duration,
      cookedAt,
      timesCooked,
      method,
      pits,
      tags,
      isDraft,
      isSignature,
      toRetry,
      shared,
      loved,
      createdAt,
      updatedAt,
    },
  }
}

function readCustomBg(value: unknown, opts: ValidateOptions): ValidateResult<CustomBg> {
  const rec = asRecord(value)
  if (!rec) return fail('自定义背景格式不对。')
  const id = readString(rec.id)
  const src = readString(rec.src)
  if (!id || !src) return fail('自定义背景缺少编号或图片。')
  if (opts.images === 'reject' && !isAllowedImageSrc(src)) {
    return fail('自定义背景含有不允许的图片地址。')
  }
  if (opts.images === 'strip' && !isAllowedImageSrc(src)) {
    return fail('skip-bg')
  }
  return { ok: true, data: { id, src } }
}

export function validateJournalState(
  input: unknown,
  opts: ValidateOptions,
): ValidateResult<JournalState> {
  const parsed = parseJsonObject(input)
  if (!parsed.ok) return parsed

  const rec = parsed.data
  if (opts.requireKind) {
    if (rec.kind !== BACKUP_KIND) return fail('这不是做菜手帐的备份文件。')
  }
  if (opts.requireSchemaVersion) {
    if (rec.schemaVersion !== SCHEMA_VERSION) {
      return fail('备份版本不受支持，未改动现有手帐。')
    }
  } else if (rec.schemaVersion !== undefined && rec.schemaVersion !== SCHEMA_VERSION) {
    return fail('数据版本不受支持，未改动现有手帐。')
  }

  if (!Array.isArray(rec.recipes)) return fail('缺少菜谱列表。')

  const recipes: Recipe[] = []
  for (const item of rec.recipes) {
    const recipe = readRecipe(item, opts)
    if (!recipe.ok) return recipe
    recipes.push(recipe.data)
  }

  const bgValue = rec.bg
  const bg: BgChoice = typeof bgValue === 'string' && bgValue.length > 0 ? bgValue : 'default'

  const customBgs: CustomBg[] = []
  if (rec.customBgs !== undefined && !Array.isArray(rec.customBgs)) {
    return fail('自定义背景列表无效。')
  }
  for (const item of Array.isArray(rec.customBgs) ? rec.customBgs : []) {
    const bgItem = readCustomBg(item, opts)
    if (!bgItem.ok) {
      if (opts.images === 'strip' && bgItem.error === 'skip-bg') continue
      return bgItem
    }
    customBgs.push(bgItem.data)
  }

  return { ok: true, data: { recipes, bg, customBgs } }
}

export function parseSnapshot(raw: unknown): ValidateResult<JournalState> {
  return validateJournalState(raw, {
    images: 'strip',
    requireKind: false,
    requireSchemaVersion: false,
  })
}

export function parseBackup(raw: unknown): ValidateResult<BackupFile> {
  const parsed = parseJsonObject(raw)
  if (!parsed.ok) return parsed
  const state = validateJournalState(parsed.data, {
    images: 'reject',
    requireKind: true,
    requireSchemaVersion: true,
  })
  if (!state.ok) return state
  const exportedAt =
    typeof parsed.data.exportedAt === 'string' && parsed.data.exportedAt
      ? parsed.data.exportedAt
      : ''
  return {
    ok: true,
    data: {
      kind: BACKUP_KIND,
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      savedAt: typeof parsed.data.savedAt === 'string' ? parsed.data.savedAt : undefined,
      recipes: state.data.recipes,
      bg: state.data.bg,
      customBgs: state.data.customBgs,
    },
  }
}

export function buildSnapshot(state: JournalState, savedAt: string): SnapshotFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt,
    recipes: state.recipes,
    bg: state.bg,
    customBgs: state.customBgs,
  }
}

export function buildBackup(state: JournalState, exportedAt: string): BackupFile {
  return {
    kind: BACKUP_KIND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    savedAt: exportedAt,
    recipes: state.recipes,
    bg: state.bg,
    customBgs: state.customBgs,
  }
}

export function snapshotToJson(state: JournalState, savedAt: string): string {
  return `${JSON.stringify(buildSnapshot(state, savedAt))}\n`
}

export function backupToJson(state: JournalState, exportedAt: string): string {
  return `${JSON.stringify(buildBackup(state, exportedAt))}\n`
}
