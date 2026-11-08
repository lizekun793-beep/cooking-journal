import { describe, expect, it } from 'vitest'
import { BG_KEY, CUSTOM_BG_KEY, RECIPES_KEY } from './keys'
import { migrateFromLocalStorage } from './migrate'
import { JournalStore } from './store'
import { memoryFiles, memoryStorage, recipe } from './testUtils'
import { snapshotToJson } from './validate'

describe('legacy localStorage migration', () => {
  it('migrates the three cooking-journal keys and keeps photos', () => {
    const storage = memoryStorage({
      [RECIPES_KEY]: JSON.stringify([recipe({ id: 'web', name: '网站上的菜', photos: ['/food/stew.jpg'] })]),
      [BG_KEY]: 'male',
      [CUSTOM_BG_KEY]: JSON.stringify([
        { id: 'bg_1', src: 'data:image/jpeg;base64,/9j/xx' },
      ]),
    })
    const result = migrateFromLocalStorage(storage)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.data.recipes[0]?.photos).toEqual(['/food/stew.jpg'])
    expect(result.data.bg).toBe('male')
    expect(result.data.customBgs[0]?.src.startsWith('data:image/jpeg')).toBe(true)
    expect(result.keysPresent).toEqual([RECIPES_KEY, BG_KEY, CUSTOM_BG_KEY])
    expect(storage.removed).toEqual([])
    expect(storage.getItem(RECIPES_KEY)).toContain('网站上的菜')
  })

  it('does not treat missing keys as seed data', () => {
    expect(migrateFromLocalStorage(memoryStorage()).status).toBe('empty')
  })

  it('reports malformed recipes instead of inventing an empty journal', () => {
    const storage = memoryStorage({ [RECIPES_KEY]: '{not-json' })
    const result = migrateFromLocalStorage(storage)
    expect(result.status).toBe('malformed')
    expect(storage.getItem(RECIPES_KEY)).toBe('{not-json')
  })

  it('preserves an explicit empty recipe list', () => {
    const storage = memoryStorage({ [RECIPES_KEY]: '[]' })
    const result = migrateFromLocalStorage(storage)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.data.recipes).toEqual([])
  })
})

describe('native hydrate migration', () => {
  it('copies legacy keys into the filesystem snapshot without deleting them', async () => {
    const legacyRecipes = [recipe({ id: 'keep', name: '网页记录', photos: ['/food/noodles.jpg'] })]
    const storage = memoryStorage({
      [RECIPES_KEY]: JSON.stringify(legacyRecipes),
      [BG_KEY]: 'default',
      [CUSTOM_BG_KEY]: '[]',
    })
    const files = memoryFiles()
    const store = new JournalStore({
      isNative: true,
      files,
      webStorage: storage,
      seed: () => [recipe({ id: 'seed', name: '不该出现' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.source).toBe('legacy')
    expect(hydrated.state.recipes[0]?.id).toBe('keep')
    expect(files.map.get('journal/snapshot.json')).toContain('网页记录')
    expect(storage.removed).toEqual([])
    expect(storage.getItem(RECIPES_KEY)).toContain('网页记录')
  })

  it('does not write seed over malformed legacy keys', async () => {
    const storage = memoryStorage({ [RECIPES_KEY]: '["oops"' })
    const files = memoryFiles()
    const store = new JournalStore({
      isNative: true,
      files,
      webStorage: storage,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.persistBlocked).toBe(true)
    expect(hydrated.state.recipes).toEqual([])
    expect(files.map.has('journal/snapshot.json')).toBe(false)
    expect(storage.getItem(RECIPES_KEY)).toBe('["oops"')
    await expect(store.save(hydrated.state)).rejects.toThrow(/以免覆盖/)
  })

  it('does not claim migration succeeded when the first native write fails', async () => {
    const legacyRecipes = [recipe({ id: 'keep', name: '网页记录' })]
    const storage = memoryStorage({
      [RECIPES_KEY]: JSON.stringify(legacyRecipes),
      [BG_KEY]: 'default',
      [CUSTOM_BG_KEY]: '[]',
    })
    const files = memoryFiles({}, { write: { 'journal/snapshot.json.tmp': new Error('ENOSPC') } })
    const store = new JournalStore({
      isNative: true,
      files,
      webStorage: storage,
      seed: () => [recipe({ id: 'seed', name: '不该出现' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.source).toBe('legacy')
    expect(hydrated.state.recipes[0]?.id).toBe('keep')
    expect(hydrated.persistBlocked).toBe(false)
    expect(hydrated.warning).toMatch(/尚未完成迁移/)
    expect(hydrated.warning).not.toMatch(/已从网页版本地记录迁到应用文件/)
    expect(files.map.has('journal/snapshot.json')).toBe(false)
    expect(storage.getItem(RECIPES_KEY)).toContain('网页记录')
  })

  it('does not reseed when a valid native snapshot already exists', async () => {
    const files = memoryFiles({
      'journal/snapshot.json': snapshotToJson(
        { recipes: [recipe({ id: 'native', name: '文件里的菜' })], bg: 'male', customBgs: [] },
        '2026-11-08T00:00:00.000Z',
      ),
    })
    const storage = memoryStorage({
      [RECIPES_KEY]: JSON.stringify([recipe({ id: 'web', name: '网页的菜' })]),
    })
    const store = new JournalStore({
      isNative: true,
      files,
      webStorage: storage,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.source).toBe('current')
    expect(hydrated.state.recipes[0]?.id).toBe('native')
    expect(storage.getItem(RECIPES_KEY)).toContain('网页的菜')
  })
})
