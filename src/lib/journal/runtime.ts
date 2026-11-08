import { createDefaultDeps } from './defaultDeps'
import { JournalStore } from './store'

let store: JournalStore | null = null

export function journalStore(): JournalStore {
  if (!store) store = new JournalStore(createDefaultDeps())
  return store
}

export function resetJournalStoreForTests(): void {
  store = null
}
