const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function padMD(iso: string): string {
  const d = parseISODate(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function formatRelative(iso: string, now = new Date()): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(parseISODate(iso)).getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  if (diff > 2 && diff < 7) return `${diff} 天前`
  if (diff >= 7 && diff < 14) return '上周'
  return padMD(iso)
}

export function formatFieldDate(iso: string, now = new Date()): string {
  return `${formatRelative(iso, now)} · ${padMD(iso)}`
}

export function isThisWeek(iso: string, now = new Date()): boolean {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(parseISODate(iso)).getTime()) / 86400000)
  return diff >= 0 && diff < 7
}

export function formatEntryMeta(iso: string, duration: string, isNashou: boolean): string {
  if (isNashou && isThisWeek(iso)) return `本周拿手 · ${duration}`
  return `${formatRelative(iso)} · ${duration}`
}

export function dateStamp(now = new Date()): { month: string; day: string; year: string } {
  return {
    month: MONTHS[now.getMonth()],
    day: String(now.getDate()).padStart(2, '0'),
    year: String(now.getFullYear()),
  }
}

export function uid(prefix = 'r'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 7)}${Date.now().toString(36)}`
}
