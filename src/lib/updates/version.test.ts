import { describe, expect, it } from 'vitest'
import { compareVersionCode, parseVersionCode, parseVersionJson } from './version'

describe('versionCode comparison', () => {
  it('treats a greater remote code as an update', () => {
    expect(compareVersionCode(1, 2)).toBe('update-available')
    expect(compareVersionCode(3, 3)).toBe('up-to-date')
    expect(compareVersionCode(5, 4)).toBe('local-newer')
  })

  it('rejects non-positive or non-integer codes', () => {
    expect(parseVersionCode(0)).toBeNull()
    expect(parseVersionCode(-1)).toBeNull()
    expect(parseVersionCode(1.5)).toBeNull()
    expect(parseVersionCode('01')).toBe(1)
    expect(() => compareVersionCode(1, 0)).toThrow(/invalid-version-code/)
  })
})

describe('version.json', () => {
  it('reads versionName and monotonic versionCode', () => {
    const parsed = parseVersionJson({
      versionName: '1.0.1',
      versionCode: 2,
      apkFile: 'kitchen-journal-1.0.1.apk',
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.versionCode).toBe(2)
  })

  it('rejects malformed documents', () => {
    expect(parseVersionJson('nope').ok).toBe(false)
    expect(parseVersionJson({ versionName: '1.0.0' }).ok).toBe(false)
    expect(parseVersionJson({ versionName: '1.0.0', versionCode: 0 }).ok).toBe(false)
  })
})
