import type { ReleaseCheck } from './check'
import { RELEASE_PAGE_LATEST } from './urls'

export type Channel = 'android' | 'web'

export type InstalledVersion = {
  versionName: string
  versionCode: number
  channel: Channel
}

export const COPY = {
  entryTitle: '版本更新',
  badge: '有新版',
  sheetTitle: '版本更新',
  stale: '上次检查结果',
  initial: '检查是否有新版本',
  check: '检查更新',
  loading: '正在检查新版本…',
  checking: '检查中…',
  latest: '已经是最新版本',
  recheck: '重新检查',
  offline: '暂时无法检查更新，请检查网络后重试',
  retry: '重试',
  noRelease: '暂无新版本发布',
  notesLabel: '更新内容',
  notesFallback: '此版本暂未提供更新说明',
  noApk: '此版本暂未提供安装包',
  download: '下载安装',
  later: '稍后再说',
  viewRelease: '查看发布页',
  auxiliary: '将在浏览器下载，下载后需手动确认安装。',
  opened: '已打开浏览器，请下载后按安卓系统提示安装',
  openFailed: '未能打开浏览器，请重试',
} as const

export function withV(versionName: string): string {
  const t = versionName.trim()
  if (!t) return ''
  return /^v/i.test(t) ? `v${t.slice(1)}` : `v${t}`
}

export function formatInstalledSubtitle(installed: InstalledVersion): string {
  const v = withV(installed.versionName)
  if (!v) return ''
  if (installed.channel === 'web') return `当前版本 ${v}（网页）`
  return `当前版本 ${v}`
}

export function foundUpdateHeading(versionName: string): string {
  return `发现新版本 ${withV(versionName)}`
}

export function notesText(notes: string | null | undefined): { text: string; fallback: boolean } {
  if (typeof notes === 'string' && notes.trim()) {
    return { text: notes.trim(), fallback: false }
  }
  return { text: COPY.notesFallback, fallback: true }
}

export type EntryView = {
  title: string
  subtitle: string
  badge: string | null
}

export function deriveEntry(installed: InstalledVersion | null, last: ReleaseCheck | null): EntryView {
  const subtitle = installed ? formatInstalledSubtitle(installed) : ''
  const badge = last?.status === 'update-available' ? COPY.badge : null
  return { title: COPY.entryTitle, subtitle, badge }
}

export type SheetButton = {
  label: string
  action: 'check' | 'download' | 'retry' | 'later' | 'release-page'
  disabled?: boolean
}

export type SheetView = {
  title: string
  stale: boolean
  heading: string
  headingTone: 'ink' | 'ok' | 'accent' | 'muted'
  body?: string
  notesLabel?: string
  notes?: string
  noApk?: string
  auxiliary?: string
  openHint?: string
  htmlUrl: string | null
  apkUrl: string | null
  primary: SheetButton
  extra?: SheetButton
  secondary?: SheetButton
}

export type SheetModelInput = {
  checking: boolean
  last: ReleaseCheck | null
  failed: boolean
  download: 'idle' | 'opened' | 'failed'
}

function base(over: Omit<SheetView, 'title' | 'htmlUrl' | 'apkUrl'> & Partial<Pick<SheetView, 'htmlUrl' | 'apkUrl'>>): SheetView {
  return {
    title: COPY.sheetTitle,
    htmlUrl: over.htmlUrl ?? null,
    apkUrl: over.apkUrl ?? null,
    ...over,
  }
}

function releasePage(htmlUrl: string | null): string | null {
  return htmlUrl || RELEASE_PAGE_LATEST
}

function availableSheet(
  last: Extract<ReleaseCheck, { status: 'update-available' }>,
  stale: boolean,
  download: SheetModelInput['download'],
  failed: boolean,
): SheetView {
  const hasApk = typeof last.apkUrl === 'string' && last.apkUrl.length > 0
  const notes = notesText(last.notes)
  const htmlUrl = releasePage(last.htmlUrl)
  const openHint =
    download === 'opened' ? COPY.opened : download === 'failed' ? COPY.openFailed : undefined

  if (!hasApk) {
    return base({
      stale,
      heading: foundUpdateHeading(last.versionName),
      headingTone: 'accent',
      noApk: COPY.noApk,
      notesLabel: COPY.notesLabel,
      notes: notes.text,
      htmlUrl,
      apkUrl: null,
      body: failed ? COPY.offline : undefined,
      primary: { label: failed ? COPY.retry : COPY.recheck, action: failed ? 'retry' : 'check' },
      secondary: { label: COPY.viewRelease, action: 'release-page' },
    })
  }

  return base({
    stale,
    heading: foundUpdateHeading(last.versionName),
    headingTone: 'accent',
    notesLabel: COPY.notesLabel,
    notes: notes.text,
    auxiliary: COPY.auxiliary,
    openHint,
    htmlUrl,
    apkUrl: last.apkUrl,
    body: failed ? COPY.offline : undefined,
    primary: { label: COPY.download, action: 'download' },
    extra: failed ? { label: COPY.retry, action: 'retry' } : undefined,
    secondary: { label: COPY.later, action: 'later' },
  })
}

export function deriveSheet(input: SheetModelInput): SheetView {
  const stale = input.failed && input.last != null && !input.checking

  if (input.checking) {
    return base({
      stale: false,
      heading: COPY.loading,
      headingTone: 'muted',
      primary: { label: COPY.checking, action: 'check', disabled: true },
    })
  }

  if (input.last?.status === 'update-available') {
    return availableSheet(input.last, stale, input.download, input.failed)
  }

  if (input.last?.status === 'up-to-date' || input.last?.status === 'local-newer') {
    return base({
      stale,
      heading: COPY.latest,
      headingTone: 'ok',
      body: input.failed ? COPY.offline : undefined,
      htmlUrl: input.last.htmlUrl,
      apkUrl: null,
      primary: { label: input.failed ? COPY.retry : COPY.recheck, action: input.failed ? 'retry' : 'check' },
    })
  }

  if (input.last?.status === 'no-release') {
    return base({
      stale,
      heading: COPY.noRelease,
      headingTone: 'ink',
      body: input.failed ? COPY.offline : undefined,
      primary: { label: input.failed ? COPY.retry : COPY.recheck, action: input.failed ? 'retry' : 'check' },
    })
  }

  if (input.failed) {
    return base({
      stale: false,
      heading: COPY.offline,
      headingTone: 'ink',
      primary: { label: COPY.retry, action: 'retry' },
    })
  }

  return base({
    stale: false,
    heading: COPY.initial,
    headingTone: 'ink',
    primary: { label: COPY.check, action: 'check' },
  })
}
