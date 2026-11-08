import type { Recipe } from '../../types'
import type { FileStore, JournalState, StorageLike } from './types'

export function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return {
    photos: ['/food/hongshaorou.jpg'],
    duration: '约 10 分钟',
    cookedAt: '2026-11-08',
    timesCooked: 1,
    method: '炒一下。',
    pits: [],
    tags: [{ label: '家常', kind: 'plain' }],
    isDraft: false,
    isSignature: false,
    toRetry: false,
    shared: false,
    loved: false,
    createdAt: '2026-11-08T00:00:00.000Z',
    updatedAt: '2026-11-08T00:00:00.000Z',
    ...partial,
  }
}

export function state(over: Partial<JournalState> = {}): JournalState {
  return {
    recipes: [recipe({ id: 'r1', name: '红烧肉' })],
    bg: 'default',
    customBgs: [],
    ...over,
  }
}

export type FileStoreFaults = {
  read?: Record<string, Error>
  write?: Record<string, Error>
  rename?: Error
  copy?: Error
  /** Write this payload instead of the caller’s data (torn / corrupt write). */
  corruptWrite?: Record<string, string>
}

export function memoryFiles(
  init: Record<string, string> = {},
  faults: FileStoreFaults = {},
): FileStore & {
  map: Map<string, string>
  writes: string[]
  renames: Array<{ from: string; to: string }>
} {
  const map = new Map(Object.entries(init))
  const writes: string[] = []
  const renames: Array<{ from: string; to: string }> = []
  return {
    map,
    writes,
    renames,
    async readUtf8(path) {
      const fault = faults.read?.[path]
      if (fault) throw fault
      return map.has(path) ? map.get(path)! : null
    },
    async writeUtf8(path, data) {
      const fault = faults.write?.[path]
      if (fault) throw fault
      writes.push(path)
      map.set(path, faults.corruptWrite?.[path] ?? data)
    },
    async copy(from, to) {
      if (faults.copy) throw faults.copy
      if (!map.has(from)) throw new Error(`missing:${from}`)
      map.set(to, map.get(from)!)
    },
    async rename(from, to) {
      if (faults.rename) throw faults.rename
      if (!map.has(from)) throw new Error(`missing:${from}`)
      renames.push({ from, to })
      map.set(to, map.get(from)!)
      map.delete(from)
    },
    async remove(path) {
      map.delete(path)
    },
  }
}

export function memoryStorage(init: Record<string, string> = {}): StorageLike & {
  map: Map<string, string>
  removed: string[]
} {
  const map = new Map(Object.entries(init))
  const removed: string[] = []
  return {
    map,
    removed,
    getItem(key) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key, value) {
      map.set(key, value)
    },
    removeItem(key) {
      removed.push(key)
      map.delete(key)
    },
  }
}
