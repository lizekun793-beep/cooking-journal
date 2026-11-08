import { describe, expect, it } from 'vitest'
import { checkLatestRelease, readReleaseNotes } from './check'
import type { HttpGet } from './http'
import { LATEST_RELEASE_API } from './urls'

const VERSION_API = 'https://api.github.com/repos/lizekun793-beep/cooking-journal/releases/assets/11'
const APK =
  'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.1/kitchen-journal-1.0.1.apk'
const HTML = 'https://github.com/lizekun793-beep/cooking-journal/releases/tag/v1.0.1'
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
  tag_name: 'v1.0.1',
  html_url: HTML,
  body: '修复导出备份。\n\n- 更快的启动',
  assets: [
    {
      name: 'version.json',
      url: VERSION_API,
      browser_download_url:
        'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.1/version.json',
    },
    {
      name: 'kitchen-journal-1.0.1.apk',
      browser_download_url: APK,
    },
  ],
})

describe('checkLatestRelease', () => {
  it('treats a 404 latest release as no-release', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: httpGet({ [LATEST_RELEASE_API]: { status: 404, body: '{"message":"Not Found"}' } }),
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
          body: JSON.stringify({ versionName: '1.0.1', versionCode: 2, apkFile: 'kitchen-journal-1.0.1.apk' }),
        },
      }),
    })
    expect(result.status).toBe('update-available')
    if (result.status !== 'update-available') return
    expect(result.versionCode).toBe(2)
    expect(result.versionName).toBe('1.0.1')
    expect(result.apkUrl).toBe(APK)
    expect(result.htmlUrl).toBe(HTML)
    expect(result.notes).toContain('修复导出备份')
  })

  it('reports up-to-date only after a real versionCode comparison', async () => {
    const result = await checkLatestRelease({
      localVersionCode: 2,
      httpGet: httpGet({
        [LATEST_RELEASE_API]: { status: 200, body: latestBody },
        [VERSION_API]: {
          status: 200,
          body: JSON.stringify({ versionName: '1.0.1', versionCode: 2 }),
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

  it('maps timeout and network failures to unavailable', async () => {
    const timeout = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: async () => {
        throw new Error('timeout')
      },
    })
    expect(timeout).toEqual({ status: 'unavailable', reason: 'timeout' })

    const network = await checkLatestRelease({
      localVersionCode: 1,
      httpGet: async () => {
        throw new Error('offline')
      },
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
          body: JSON.stringify({ versionName: '1.0.1', versionCode: 2 }),
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
    })
    expect(result).toEqual({ status: 'no-release' })
  })
})

describe('readReleaseNotes', () => {
  it('trims notes and treats blank bodies as missing', () => {
    expect(readReleaseNotes('  hello \n')).toBe('hello')
    expect(readReleaseNotes('   ')).toBeNull()
    expect(readReleaseNotes(null)).toBeNull()
  })
})
