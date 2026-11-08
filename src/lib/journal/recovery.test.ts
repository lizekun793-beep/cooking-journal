import { describe, expect, it } from 'vitest'
import { recoverSnapshot } from './recovery'
import { JournalStore } from './store'
import { memoryFiles, recipe, state } from './testUtils'
import { snapshotToJson } from './validate'

const good = snapshotToJson(state({ recipes: [recipe({ id: 'good', name: '完好' })] }), '2026-11-08T00:00:00.000Z')
const older = snapshotToJson(state({ recipes: [recipe({ id: 'prev', name: '上一份' })] }), '2026-11-07T00:00:00.000Z')

describe('recoverSnapshot', () => {
  it('uses the current snapshot when it is valid', () => {
    const result = recoverSnapshot(good, older)
    expect(result.source).toBe('current')
    if (result.source === 'none') return
    expect(result.data.recipes[0]?.id).toBe('good')
  })

  it('falls back to the previous copy when current JSON is malformed', () => {
    const result = recoverSnapshot('{broken', older)
    expect(result.source).toBe('previous')
    if (result.source === 'none') return
    expect(result.data.recipes[0]?.id).toBe('prev')
  })

  it('returns none when both copies are unreadable', () => {
    const result = recoverSnapshot('{broken', 'null')
    expect(result.source).toBe('none')
  })

  it('does not invent seed data from empty inputs', () => {
    expect(recoverSnapshot(null, null).source).toBe('none')
    expect(recoverSnapshot('', '  ').source).toBe('none')
  })
})

describe('native snapshot rotation and hydrate recovery', () => {
  it('copies a valid current snapshot to previous before writing', async () => {
    const files = memoryFiles({ 'journal/snapshot.json': good })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    await store.save(state({ recipes: [recipe({ id: 'next', name: '下一份' })] }))
    expect(files.map.get('journal/snapshot.prev.json')).toContain('"good"')
    expect(files.map.get('journal/snapshot.json')).toContain('"next"')
  })

  it('hydrates from previous when current is damaged and does not seed', async () => {
    const files = memoryFiles({
      'journal/snapshot.json': '{nope',
      'journal/snapshot.prev.json': older,
    })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '不该出现' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.source).toBe('previous')
    expect(hydrated.persistBlocked).toBe(false)
    expect(hydrated.state.recipes[0]?.id).toBe('prev')
    expect(files.map.get('journal/snapshot.json')).toContain('"prev"')
  })

  it('blocks writes instead of seeding over an unreadable native file', async () => {
    const files = memoryFiles({ 'journal/snapshot.json': '{nope' })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.persistBlocked).toBe(true)
    expect(files.map.get('journal/snapshot.json')).toBe('{nope')
    await expect(
      store.save(state({ recipes: [recipe({ id: 'x', name: '覆盖' })] })),
    ).rejects.toThrow(/以免覆盖/)
    expect(files.map.get('journal/snapshot.json')).toBe('{nope')
  })

  it('seeds only when no snapshot or legacy data exists', async () => {
    const files = memoryFiles()
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.source).toBe('seed')
    expect(hydrated.state.recipes[0]?.id).toBe('seed')
    expect(files.map.get('journal/snapshot.json')).toContain('"seed"')
  })

  it('blocks and does not seed when current read fails with a non-not-found error', async () => {
    const files = memoryFiles(
      {},
      { read: { 'journal/snapshot.json': Object.assign(new Error('EACCES'), { code: 'OS-PLUG-FILE-0007' }) } },
    )
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '不该出现' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.persistBlocked).toBe(true)
    expect(hydrated.state.recipes).toEqual([])
    expect(files.map.has('journal/snapshot.json')).toBe(false)
    expect(hydrated.warning).toMatch(/为避免覆盖/)
    await expect(store.save(state({ recipes: [recipe({ id: 'x', name: '覆盖' })] }))).rejects.toThrow(
      /以免覆盖/,
    )
  })

  it('does not treat an unreadable previous copy as missing when current is absent', async () => {
    const files = memoryFiles(
      {},
      { read: { 'journal/snapshot.prev.json': Object.assign(new Error('EIO'), { code: 'OS-PLUG-FILE-0013' }) } },
    )
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '不该出现' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.persistBlocked).toBe(true)
    expect(hydrated.state.recipes.map((r) => r.id)).not.toContain('seed')
    expect(files.map.has('journal/snapshot.json')).toBe(false)
  })

  it('serves previous data but blocks writes when current I/O fails', async () => {
    const files = memoryFiles(
      { 'journal/snapshot.prev.json': older },
      { read: { 'journal/snapshot.json': Object.assign(new Error('EACCES'), { code: 'OS-PLUG-FILE-0007' }) } },
    )
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '不该出现' })],
    })
    const hydrated = await store.hydrate()
    expect(hydrated.persistBlocked).toBe(true)
    expect(hydrated.state.recipes[0]?.id).toBe('prev')
    expect(files.map.has('journal/snapshot.json')).toBe(false)
    expect(files.map.get('journal/snapshot.prev.json')).toBe(older)
  })
})

describe('native staged snapshot write', () => {
  it('replaces current via staging rename and keeps the previous valid snapshot', async () => {
    const files = memoryFiles({ 'journal/snapshot.json': good })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    await store.save(state({ recipes: [recipe({ id: 'next', name: '下一份' })] }))
    expect(files.map.get('journal/snapshot.prev.json')).toContain('"good"')
    expect(files.map.get('journal/snapshot.json')).toContain('"next"')
    expect(files.map.has('journal/snapshot.json.tmp')).toBe(false)
    expect(files.renames.some((step) => step.to === 'journal/snapshot.json')).toBe(true)
  })

  it('leaves current and previous intact when the staging write fails', async () => {
    const files = memoryFiles(
      {
        'journal/snapshot.json': good,
        'journal/snapshot.prev.json': older,
      },
      { write: { 'journal/snapshot.json.tmp': new Error('ENOSPC') } },
    )
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    await expect(store.save(state({ recipes: [recipe({ id: 'next', name: '下一份' })] }))).rejects.toThrow(
      /ENOSPC/,
    )
    expect(files.map.get('journal/snapshot.json')).toBe(good)
    expect(files.map.get('journal/snapshot.prev.json')).toBe(older)
  })

  it('leaves current intact when staging content fails validation', async () => {
    const files = memoryFiles(
      { 'journal/snapshot.json': good },
      { corruptWrite: { 'journal/snapshot.json.tmp': '{nope' } },
    )
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    await expect(store.save(state({ recipes: [recipe({ id: 'next', name: '下一份' })] }))).rejects.toThrow(
      /暂存快照校验失败/,
    )
    expect(files.map.get('journal/snapshot.json')).toBe(good)
  })

  it('leaves current intact when rename of the staging file fails', async () => {
    const files = memoryFiles({ 'journal/snapshot.json': good }, { rename: new Error('rename failed') })
    const store = new JournalStore({
      isNative: true,
      files,
      seed: () => [recipe({ id: 'seed', name: '示例' })],
    })
    await store.hydrate()
    await expect(store.save(state({ recipes: [recipe({ id: 'next', name: '下一份' })] }))).rejects.toThrow(
      /rename failed/,
    )
    expect(files.map.get('journal/snapshot.json')).toBe(good)
  })
})
