import { BG_KEY, CUSTOM_BG_KEY, LEGACY_KEYS, RECIPES_KEY } from './keys'
import type { JournalState, MigrateResult, StorageLike } from './types'
import { validateJournalState } from './validate'

function keysPresent(storage: StorageLike): string[] {
  return LEGACY_KEYS.filter((key) => storage.getItem(key) != null)
}

/**
 * Read the original three localStorage keys. Never deletes or overwrites them.
 * Malformed recipes JSON is reported instead of replaced with seed data.
 */
export function migrateFromLocalStorage(storage: StorageLike | undefined | null): MigrateResult {
  if (!storage) return { status: 'empty' }

  const recipesRaw = storage.getItem(RECIPES_KEY)
  const bgRaw = storage.getItem(BG_KEY)
  const customRaw = storage.getItem(CUSTOM_BG_KEY)
  const present = keysPresent(storage)

  if (recipesRaw == null && bgRaw == null && customRaw == null) {
    return { status: 'empty' }
  }

  if (recipesRaw != null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(recipesRaw) as unknown
    } catch {
      return { status: 'malformed', error: '原有菜谱 JSON 无法解析。' }
    }
    if (!Array.isArray(parsed)) {
      return { status: 'malformed', error: '原有菜谱不是列表。' }
    }
  }

  let customBgs: unknown = []
  if (customRaw != null) {
    try {
      customBgs = JSON.parse(customRaw) as unknown
    } catch {
      return { status: 'malformed', error: '原有自定义背景 JSON 无法解析。' }
    }
    if (!Array.isArray(customBgs)) {
      return { status: 'malformed', error: '原有自定义背景不是列表。' }
    }
  }

  const wrapped = {
    schemaVersion: 1,
    recipes: recipesRaw == null ? [] : (JSON.parse(recipesRaw) as unknown),
    bg: bgRaw && bgRaw.length > 0 ? bgRaw : 'default',
    customBgs,
  }

  const validated = validateJournalState(wrapped, { images: 'strip', requireSchemaVersion: false })
  if (!validated.ok) {
    return { status: 'malformed', error: validated.error }
  }

  const data: JournalState = validated.data
  return { status: 'ok', data, keysPresent: present }
}

export function writeLegacyKeys(storage: StorageLike, state: JournalState): void {
  storage.setItem(RECIPES_KEY, JSON.stringify(state.recipes))
  storage.setItem(BG_KEY, state.bg)
  storage.setItem(CUSTOM_BG_KEY, JSON.stringify(state.customBgs))
}
