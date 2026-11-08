import { seedRecipes } from '../../data/seed'
import { isNativeApp } from '../platform'
import { capacitorFileStore } from './nativeFiles'
import type { JournalStoreDeps } from './store'
import type { StorageLike } from './types'

function webStorage(): StorageLike | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
    return localStorage
  } catch {
    return undefined
  }
}

export function createDefaultDeps(): JournalStoreDeps {
  const native = isNativeApp()
  return {
    isNative: native,
    files: native ? capacitorFileStore : undefined,
    webStorage: webStorage(),
    seed: () => seedRecipes(),
  }
}
