import { describe, expect, it } from 'vitest'
import { openApprovedUrl } from './openUrl'

const APK =
  'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.1/kitchen-journal-1.0.1.apk'
const PAGE = 'https://github.com/lizekun793-beep/cooking-journal/releases/tag/v1.0.1'

describe('openApprovedUrl', () => {
  it('opens an approved APK URL in the injected native browser', async () => {
    const opened: string[] = []
    const result = await openApprovedUrl(APK, 'download', {
      native: true,
      openNative: async (url) => {
        opened.push(url)
      },
      openWeb: () => null,
    })
    expect(result).toBe('opened')
    expect(opened).toEqual([APK])
  })

  it('reports native browser open failure without claiming install success', async () => {
    const result = await openApprovedUrl(APK, 'download', {
      native: true,
      openNative: async () => {
        throw new Error('no activity')
      },
      openWeb: () => null,
    })
    expect(result).toBe('failed')
  })

  it('blocks an arbitrary APK URL', async () => {
    const result = await openApprovedUrl('https://evil.example/app.apk', 'download', {
      native: true,
      openNative: async () => {
        throw new Error('should not open')
      },
      openWeb: () => {
        throw new Error('should not open')
      },
    })
    expect(result).toBe('blocked')
  })

  it('opens an approved release page and reports web popup failure', async () => {
    const ok = await openApprovedUrl(PAGE, 'page', {
      native: false,
      openNative: async () => undefined,
      openWeb: () => ({}) as Window,
    })
    expect(ok).toBe('opened')
    const failed = await openApprovedUrl(PAGE, 'page', {
      native: false,
      openNative: async () => undefined,
      openWeb: () => null,
    })
    expect(failed).toBe('failed')
  })
})
