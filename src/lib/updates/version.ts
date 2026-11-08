export type VersionCmp = 'update-available' | 'up-to-date' | 'local-newer'

export function parseVersionCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number.parseInt(value, 10)
    if (Number.isInteger(n) && n >= 1) return n
  }
  return null
}

export function compareVersionCode(local: number, remote: number): VersionCmp {
  const a = parseVersionCode(local)
  const b = parseVersionCode(remote)
  if (a == null || b == null) {
    throw new Error('invalid-version-code')
  }
  if (b > a) return 'update-available'
  if (b === a) return 'up-to-date'
  return 'local-newer'
}

export type VersionJson = {
  versionName: string
  versionCode: number
  apkFile?: string
  apkUrl?: string
}

export function parseVersionJson(input: unknown): { ok: true; data: VersionJson } | { ok: false; error: string } {
  let value = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown
    } catch {
      return { ok: false, error: 'version.json 不是有效 JSON。' }
    }
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'version.json 格式不对。' }
  }
  const rec = value as Record<string, unknown>
  const versionName = rec.versionName
  const versionCode = parseVersionCode(rec.versionCode)
  if (typeof versionName !== 'string' || !versionName.trim()) {
    return { ok: false, error: 'version.json 缺少 versionName。' }
  }
  if (versionCode == null) {
    return { ok: false, error: 'version.json 缺少有效 versionCode。' }
  }
  const apkFile = typeof rec.apkFile === 'string' ? rec.apkFile : undefined
  const apkUrl = typeof rec.apkUrl === 'string' ? rec.apkUrl : undefined
  return {
    ok: true,
    data: { versionName: versionName.trim(), versionCode, apkFile, apkUrl },
  }
}
