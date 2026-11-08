import { describe, expect, it } from 'vitest'
import type { ReleaseCheck } from './check'
import {
  COPY,
  deriveEntry,
  deriveSheet,
  formatInstalledSubtitle,
  foundUpdateHeading,
  notesText,
  withV,
} from './presentation'

const installedAndroid = { versionName: '1.0.0', versionCode: 1, channel: 'android' as const }
const installedWeb = { versionName: '1.0.0', versionCode: 1, channel: 'web' as const }

const available: Extract<ReleaseCheck, { status: 'update-available' }> = {
  status: 'update-available',
  versionName: '1.0.1',
  versionCode: 2,
  notes: '修复导出。',
  htmlUrl: 'https://github.com/lizekun793-beep/cooking-journal/releases/tag/v1.0.1',
  apkUrl: 'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.1/app.apk',
}

const latest: ReleaseCheck = {
  status: 'up-to-date',
  versionName: '1.0.0',
  versionCode: 1,
  notes: null,
  htmlUrl: null,
  apkUrl: null,
}

describe('installed labels', () => {
  it('prefixes v and marks the web channel', () => {
    expect(withV('1.0.0')).toBe('v1.0.0')
    expect(withV('v1.0.0')).toBe('v1.0.0')
    expect(formatInstalledSubtitle(installedAndroid)).toBe('当前版本 v1.0.0')
    expect(formatInstalledSubtitle(installedWeb)).toBe('当前版本 v1.0.0（网页）')
  })
})

describe('deriveEntry', () => {
  it('shows 有新版 only when a newer release actually exists', () => {
    expect(deriveEntry(installedAndroid, null).badge).toBeNull()
    expect(deriveEntry(installedAndroid, latest).badge).toBeNull()
    expect(deriveEntry(installedAndroid, { status: 'no-release' }).badge).toBeNull()
    expect(deriveEntry(installedAndroid, { status: 'unavailable', reason: 'network' }).badge).toBeNull()
    const entry = deriveEntry(installedAndroid, available)
    expect(entry.title).toBe('版本更新')
    expect(entry.subtitle).toBe('当前版本 v1.0.0')
    expect(entry.badge).toBe('有新版')
  })
})

describe('deriveSheet', () => {
  it('starts with 检查是否有新版本', () => {
    const sheet = deriveSheet({ checking: false, last: null, failed: false, download: 'idle' })
    expect(sheet.heading).toBe(COPY.initial)
    expect(sheet.primary).toEqual({ label: COPY.check, action: 'check' })
  })

  it('shows a closable loading state without claiming success', () => {
    const sheet = deriveSheet({ checking: true, last: available, failed: false, download: 'idle' })
    expect(sheet.heading).toBe(COPY.loading)
    expect(sheet.primary).toEqual({ label: COPY.checking, action: 'check', disabled: true })
    expect(sheet.stale).toBe(false)
  })

  it('says 已经是最新版本 only after a successful comparison', () => {
    const sheet = deriveSheet({ checking: false, last: latest, failed: false, download: 'idle' })
    expect(sheet.heading).toBe(COPY.latest)
    expect(sheet.headingTone).toBe('ok')
    expect(sheet.primary.label).toBe(COPY.recheck)
    const newer = deriveSheet({
      checking: false,
      last: { ...latest, status: 'local-newer' },
      failed: false,
      download: 'idle',
    })
    expect(newer.heading).toBe(COPY.latest)
  })

  it('does not treat 404 no-release as 已经是最新版本', () => {
    const sheet = deriveSheet({
      checking: false,
      last: { status: 'no-release' },
      failed: false,
      download: 'idle',
    })
    expect(sheet.heading).toBe(COPY.noRelease)
    expect(sheet.heading).not.toBe(COPY.latest)
  })

  it('shows offline copy and 重试 when there is no retained result', () => {
    const sheet = deriveSheet({ checking: false, last: null, failed: true, download: 'idle' })
    expect(sheet.heading).toBe(COPY.offline)
    expect(sheet.primary).toEqual({ label: COPY.retry, action: 'retry' })
  })

  it('marks a retained result as 上次检查结果 after a later failure', () => {
    const sheet = deriveSheet({ checking: false, last: latest, failed: true, download: 'idle' })
    expect(sheet.stale).toBe(true)
    expect(sheet.heading).toBe(COPY.latest)
    expect(sheet.body).toBe(COPY.offline)
    expect(sheet.primary.action).toBe('retry')
  })

  it('shows the real remote version, notes, download and later actions', () => {
    const sheet = deriveSheet({ checking: false, last: available, failed: false, download: 'idle' })
    expect(sheet.heading).toBe(foundUpdateHeading('1.0.1'))
    expect(sheet.notesLabel).toBe(COPY.notesLabel)
    expect(sheet.notes).toBe('修复导出。')
    expect(sheet.auxiliary).toBe(COPY.auxiliary)
    expect(sheet.primary).toEqual({ label: COPY.download, action: 'download' })
    expect(sheet.secondary).toEqual({ label: COPY.later, action: 'later' })
  })

  it('uses the notes fallback and hides download when the APK is missing', () => {
    const sheet = deriveSheet({
      checking: false,
      last: { ...available, notes: null, apkUrl: null },
      failed: false,
      download: 'idle',
    })
    expect(sheet.notes).toBe(COPY.notesFallback)
    expect(sheet.noApk).toBe(COPY.noApk)
    expect(sheet.primary.action).not.toBe('download')
    expect(sheet.secondary).toEqual({ label: COPY.viewRelease, action: 'release-page' })
  })

  it('reports browser open success and failure without fake install progress', () => {
    const opened = deriveSheet({ checking: false, last: available, failed: false, download: 'opened' })
    expect(opened.openHint).toBe(COPY.opened)
    const failed = deriveSheet({ checking: false, last: available, failed: false, download: 'failed' })
    expect(failed.openHint).toBe(COPY.openFailed)
  })

  it('keeps download on a retained new release after a later failed recheck', () => {
    const sheet = deriveSheet({ checking: false, last: available, failed: true, download: 'idle' })
    expect(sheet.stale).toBe(true)
    expect(sheet.primary.action).toBe('download')
    expect(sheet.extra).toEqual({ label: COPY.retry, action: 'retry' })
    expect(sheet.body).toBe(COPY.offline)
  })
})

describe('notesText', () => {
  it('falls back when the release has no notes', () => {
    expect(notesText(null)).toEqual({ text: COPY.notesFallback, fallback: true })
    expect(notesText('  改进启动  ')).toEqual({ text: '改进启动', fallback: false })
  })
})
