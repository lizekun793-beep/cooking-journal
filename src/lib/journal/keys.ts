/** Existing website keys. Native migration reads them and never deletes them. */
export const RECIPES_KEY = 'cooking-journal.recipes'
export const BG_KEY = 'cooking-journal.bg'
export const CUSTOM_BG_KEY = 'cooking-journal.custom-bgs'

export const WEB_SNAPSHOT_KEY = 'cooking-journal.snapshot.v1'
export const WEB_SNAPSHOT_PREV_KEY = 'cooking-journal.snapshot.prev.v1'
export const WEB_RESTORE_KEY = 'cooking-journal.snapshot.restore.v1'

export const NATIVE_SNAPSHOT_PATH = 'journal/snapshot.json'
export const NATIVE_SNAPSHOT_PREV_PATH = 'journal/snapshot.prev.json'
export const NATIVE_SNAPSHOT_STAGING_PATH = 'journal/snapshot.json.tmp'
export const NATIVE_RESTORE_PATH = 'journal/restore.prev.json'

export const SCHEMA_VERSION = 1
export const BACKUP_KIND = 'cooking-journal-backup'

export const LEGACY_KEYS = [RECIPES_KEY, BG_KEY, CUSTOM_BG_KEY] as const
