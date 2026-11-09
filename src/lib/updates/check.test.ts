import { describe, expect, it } from 'vitest'
import { checkLatestRelease, readReleaseNotes } from './check'
import type { HttpGet } from './http'
import { LATEST_RELEASE_API, UPDATE_MANIFEST_JSDELIVR, UPDATE_MANIFEST_RAW } from './urls'

const VERSION_API = 'https://api.github.com/repos/lizekun793-beep/cooking-journal/releases/assets/11'
const APK =
  'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.2/kitchen-journal-1.0.2.apk'
const HTML = 'https://github.com/lizekun793-beep/cooking-journal/releases/tag/v1.0.2'
const BAD_APK = 'https://evil.example/app.apk'

function httpGet(
  handlers: Record<string, { status: number; body: string } | (() => Promise<{ status: number; body: string }>)>,
): HttpGet {
  return async (url) => {
    const hit = handlers[url]
    if (!hit) return { status: 404, body: '' }
    return typeof hit === 'function' ? hit() : hit
  }
}

const latestBody = JSON.stringify({
  tag_name: 'v1.0.2',
  html_url: HTML,
  body: '修复导出备份。\n\n- 更快的启动',
  assets: [
    {
      name: 'version.json',
      url: VERSION_API,
      browser_download_url:
        'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.2/version.json',
    },
    {
      name: 'kitchen-journal-1.0.2.apk',
      browser_download_url: APK,
    },
  ],
})

const manifestBody = JSON.stringify({
  versionName: '1.0.2',
  versionCode: 3,
  apkFile: 'kitchen-journal-1.0.2.apk',
  apkUrl: APK,
  htmlUrl: HTML,
  notes: '备用源更新说明',
})

describe('checkLatestRelease', () => {
  it('treats a 404 latest release as no-release', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: httpGet({ [LATEST_RELEASE_API]: { status: 404, body: '{"message":"Not Found"}' } }),
      manifestFallbacks: [],
    })
    expect(result).toEqual({ status: 'no-release' })
  })

  it('reports an available update with notes and apk when remote versionCode is greater', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: { status: 200, body: latestBody },
        [VERSION_API]: {
          status: 200,
          body: JSON.stringify({ versionName: '1.0.2', versionCode: 3, apkFile: 'kitchen-journal-1.0.2.apk' }),
        },
      }),
    })
    expect(result.status).toBe('update-available')
    if (result.status !== 'update-available') return
    expect(result.versionCode).toBe(3)
    expect(result.versionName).toBe('1.0.2')
    expect(result.apkUrl).toBe(APK)
    expect(result.htmlUrl).toBe(HTML)
    expect(result.notes).toContain('修复导出备份')
  })

  it('reports up-to-date only after a real versionCode comparison', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 3,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: { status: 200, body: latestBody },
        [VERSION_API]: {
          status: 200,
          body: JSON.stringify({ versionName: '1.0.2', versionCode: 3 }),
        },
      }),
    })
    expect(result.status).toBe('up-to-date')
  })

  it('keeps the update but drops an untrusted apkUrl', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: {
          status: 200,
          body: JSON.stringify({
            html_url: HTML,
            body: '',
            assets: [
              { name: 'version.json', url: VERSION_API },
              { name: 'app.apk', browser_download_url: BAD_APK },
            ],
          }),
        },
        [VERSION_API]: {
          status: 200,
          body: JSON.stringify({ versionName: '9.0.0', versionCode: 9, apkUrl: BAD_APK }),
        },
      }),
    })
    expect(result.status).toBe('update-available')
    if (result.status !== 'update-available') return
    expect(result.apkUrl).toBeNull()
    expect(result.htmlUrl).toBe(HTML)
    expect(result.notes).toBeNull()
  })

  it('falls back to update.json when GitHub times out', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 2,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: async () => {
          throw new Error('timeout')
        },
        [UPDATE_MANIFEST_JSDELIVR]: { status: 200, body: manifestBody },
      }),
      manifestFallbacks: [UPDATE_MANIFEST_JSDELIVR, UPDATE_MANIFEST_RAW],
    })
    expect(result.status).toBe('update-available')
    if (result.status !== 'update-available') return
    expect(result.versionCode).toBe(3)
    expect(result.apkUrl).toBe(APK)
    expect(result.htmlUrl).toBe(HTML)
    expect(result.notes).toContain('备用源')
  })

  it('tries the second fallback when the first fallback fails', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 2,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: async () => {
          throw new Error('offline')
        },
        [UPDATE_MANIFEST_JSDELIVR]: { status: 500, body: 'nope' },
        [UPDATE_MANIFEST_RAW]: { status: 200, body: manifestBody },
      }),
      manifestFallbacks: [UPDATE_MANIFEST_JSDELIVR, UPDATE_MANIFEST_RAW],
    })
    expect(result.status).toBe('update-available')
    if (result.status !== 'update-available') return
    expect(result.versionCode).toBe(3)
  })

  it('maps total timeout and network failures to unavailable', async () => {
    const timeout = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: async () => {
        throw new Error('timeout')
      },
      manifestFallbacks: [UPDATE_MANIFEST_JSDELIVR],
    })
    expect(timeout).toEqual({ status: 'unavailable', reason: 'timeout' })

    const network = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: async () => {
        throw new Error('offline')
      },
      manifestFallbacks: [],
    })
    expect(network).toEqual({ status: 'unavailable', reason: 'network' })
  })

  it('reports local-newer when the installed versionCode is greater', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 9,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: { status: 200, body: latestBody },
        [VERSION_API]: {
          status: 200,
          body: JSON.stringify({ versionName: '1.0.2', versionCode: 3 }),
        },
      }),
    })
    expect(result.status).toBe('local-newer')
  })

  it('treats a missing version.json asset as no-release', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: {
          status: 200,
          body: JSON.stringify({ tag_name: 'v1', assets: [] }),
        },
      }),
      manifestFallbacks: [],
    })
    expect(result).toEqual({ status: 'no-release' })
  })

  it('builds apkUrl from apkFile when the manifest omits apkUrl', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: async () => {
          throw new Error('timeout')
        },
        [UPDATE_MANIFEST_RAW]: {
          status: 200,
          body: JSON.stringify({
            versionName: '1.0.2',
            versionCode: 3,
            apkFile: 'kitchen-journal-1.0.2.apk',
          }),
        },
      }),
      manifestFallbacks: [UPDATE_MANIFEST_RAW],
    })
    expect(result.status).toBe('update-available')
    if (result.status !== 'update-available') return
    expect(result.apkUrl).toBe(APK)
  })
})

describe('readReleaseNotes', () => {
  it('trims notes and treats blank bodies as missing', () => {
    expect(readReleaseNotes('  hello \n')).toBe('hello')
    expect(readReleaseNotes('   ')).toBeNull()
    expect(readReleaseNotes(null)).toBeNull()
  })
})
