import { describe, expect, it } from 'vitest'
import { BACKUP_KIND, SCHEMA_VERSION } from './keys'
import { isAllowedImageSrc } from './images'
import { JournalStore } from './store'
import { memoryFiles, memoryStorage, recipe, state } from './testUtils'
import { backupToJson, parseBackup } from './validate'

describe('image URL allowlist', () => {
  it('allows bundled food/background paths and jpeg data URLs', () => {
    expect(isAllowedImageSrc('/food/hongshaorou.jpg')).toBe(true)
    expect(isAllowedImageSrc('backgrounds/bg-kitchen-default.jpg')).toBe(true)
    expect(isAllowedImageSrc('data:image/jpeg;base64,/9j/4AAQ')).toBe(true)
    expect(isAllowedImageSrc('https://localhost/food/broccoli.jpg')).toBe(true)
  })

  it('rejects script, remote, svg, blob and traversal URLs', () => {
    expect(isAllowedImageSrc('javascript:alert(1)')).toBe(false)
    expect(isAllowedImageSrc('https://evil.example/pic.jpg')).toBe(false)
    expect(isAllowedImageSrc('http://localhost/food/hongshaorou.jpg')).toBe(false)
    expect(isAllowedImageSrc('data:text/html,<script>x</script>')).toBe(false)
    expect(isAllowedImageSrc('data:image/svg+xml;base64,PHN2Zy')).toBe(false)
    expect(isAllowedImageSrc('blob:https://localhost/abc')).toBe(false)
    expect(isAllowedImageSrc('/food/../secret.jpg')).toBe(false)
    expect(isAllowedImageSrc('/food/%2e%2e/x.jpg')).toBe(false)
    expect(isAllowedImageSrc('//evil.example/x.jpg')).toBe(false)
  })
})

describe('backup validation', () => {
  const valid = backupToJson(state(), '2026-11-08T00:00:00.000Z')

  it('accepts a versioned backup that includes its own photos', () => {
    const parsed = parseBackup(valid)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.kind).toBe(BACKUP_KIND)
    expect(parsed.data.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.data.recipes[0]?.photos[0]).toBe('/food/hongshaorou.jpg')
  })

  it('rejects missing kind, schema, or recipes', () => {
    expect(parseBackup('{"recipes":[]}').ok).toBe(false)
    expect(parseBackup({ kind: BACKUP_KIND, schemaVersion: 2, recipes: [] }).ok).toBe(false)
    expect(parseBackup({ kind: BACKUP_KIND, schemaVersion: 1, recipes: 'nope' }).ok).toBe(false)
    expect(parseBackup('not-json').ok).toBe(false)
  })

  it('rejects backups that contain disallowed image URLs', () => {
    const poisoned = backupToJson(
      state({
        recipes: [recipe({ id: 'x', name: '毒', photos: ['https://evil.example/x.jpg'] })],
      }),
      '2026-11-08T00:00:00.000Z',
    )
    const parsed = parseBackup(poisoned)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toMatch(/不允许的图片/)
  })
})

describe('import never overwrites on malformed input', () => {
  it('leaves the native snapshot unchanged when JSON is invalid', async () => {
    const original = JSON.stringify({
      schemaVersion: 1,
      recipes: state().recipes,
      bg: 'default',
      customBgs: [],
    })
    const files = memoryFiles({ 'journal/snapshot.json': original })
    const store = new JournalStore({
      isNative: true,
      files,
      webStorage: memoryStorage(),
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    const before = files.map.get('journal/snapshot.json')
    const result = await store.importBackup('{not json', true)
    expect(result.ok).toBe(false)
    expect(files.map.get('journal/snapshot.json')).toBe(before)
  })

  it('requires explicit confirmation and keeps current data without it', async () => {
    const current = state({ recipes: [recipe({ id: 'keep', name: '留下' })] })
    const files = memoryFiles({
      'journal/snapshot.json': JSON.stringify({
        schemaVersion: 1,
        recipes: current.recipes,
        bg: 'default',
        customBgs: [],
      }),
    })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    const incoming = backupToJson(
      state({ recipes: [recipe({ id: 'new', name: '新的' })] }),
      '2026-11-08T00:00:00.000Z',
    )
    const denied = await store.importBackup(incoming, false)
    expect(denied.ok).toBe(false)
    expect(store.getSnapshot()?.recipes[0]?.id).toBe('keep')
  })

  it('writes a restore copy then replaces state when confirmation is given', async () => {
    const current = state({ recipes: [recipe({ id: 'old', name: '旧的' })] })
    const files = memoryFiles({
      'journal/snapshot.json': JSON.stringify({
        schemaVersion: 1,
        recipes: current.recipes,
        bg: 'default',
        customBgs: [],
      }),
    })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    const incoming = backupToJson(
      state({
        recipes: [recipe({ id: 'new', name: '新的', photos: ['data:image/jpeg;base64,abc'] })],
      }),
      '2026-11-08T00:00:00.000Z',
    )
    const ok = await store.importBackup(incoming, true)
    expect(ok.ok).toBe(true)
    expect(store.getSnapshot()?.recipes[0]?.id).toBe('new')
    expect(files.map.get('journal/restore.prev.json')).toContain('"old"')
    expect(files.map.get('journal/snapshot.prev.json')).toContain('"old"')
    expect(files.map.get('journal/snapshot.json')).toContain('"new"')
  })
})
