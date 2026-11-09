import { describe, expect, it } from 'vitest'
import {
  LATEST_RELEASE_API,
  RELEASE_PAGE_LATEST,
  UPDATE_MANIFEST_JSDELIVR,
  UPDATE_MANIFEST_RAW,
  isAllowedReleasePageUrl,
  isAllowedReleaseUrl,
} from './urls'

describe('release URL allowlist', () => {
  it('allows the configured latest-release API on cooking-journal', () => {
    expect(LATEST_RELEASE_API).toBe(
      'https://api.github.com/repos/lizekun793-beep/cooking-journal/releases/latest',
    )
    expect(isAllowedReleaseUrl(LATEST_RELEASE_API)).toBe(true)
  })

  it('allows this repo download URLs and official asset hosts', () => {
    expect(
      isAllowedReleaseUrl(
        'https://github.com/lizekun793-beep/cooking-journal/releases/download/v1.0.2/kitchen-journal-1.0.2.apk',
      ),
    ).toBe(true)
    expect(
      isAllowedReleaseUrl(
        'https://github.com/lizekun793-beep/cooking-journal/releases/latest/download/version.json',
      ),
    ).toBe(true)
    expect(
      isAllowedReleaseUrl('https://api.github.com/repos/lizekun793-beep/cooking-journal/releases/assets/99'),
    ).toBe(true)
    expect(
      isAllowedReleaseUrl('https://objects.githubusercontent.com/github-production-release-asset-2e65be/123/abc'),
    ).toBe(true)
    expect(
      isAllowedReleaseUrl('https://release-assets.githubusercontent.com/github-production-release-asset-2e65be/abc'),
    ).toBe(true)
  })

  it('allows this repo update.json on jsDelivr and raw.githubusercontent.com', () => {
    expect(UPDATE_MANIFEST_JSDELIVR).toBe(
      'https://cdn.jsdelivr.net/gh/lizekun793-beep/cooking-journal@main/public/update.json',
    )
    expect(UPDATE_MANIFEST_RAW).toBe(
      'https://raw.githubusercontent.com/lizekun793-beep/cooking-journal/main/public/update.json',
    )
    expect(isAllowedReleaseUrl(UPDATE_MANIFEST_JSDELIVR)).toBe(true)
    expect(isAllowedReleaseUrl(UPDATE_MANIFEST_RAW)).toBe(true)
    expect(
      isAllowedReleaseUrl(
        'https://fastly.jsdelivr.net/gh/lizekun793-beep/cooking-journal@main/public/update.json',
      ),
    ).toBe(true)
  })

  it('allows html release pages for 查看发布页', () => {
    expect(isAllowedReleasePageUrl(RELEASE_PAGE_LATEST)).toBe(true)
    expect(
      isAllowedReleasePageUrl('https://github.com/lizekun793-beep/cooking-journal/releases/tag/v1.0.2'),
    ).toBe(true)
    expect(isAllowedReleasePageUrl('https://github.com/lizekun793-beep/cooking-journal/releases')).toBe(true)
  })

  it('rejects the old distribution repo, arbitrary APKs, http, and source archives', () => {
    expect(
      isAllowedReleaseUrl(
        'https://github.com/lizekun793-beep/cooking-journal-releases/releases/download/v1/app.apk',
      ),
    ).toBe(false)
    expect(
      isAllowedReleasePageUrl('https://github.com/lizekun793-beep/cooking-journal-releases/releases/tag/v1'),
    ).toBe(false)
    expect(isAllowedReleaseUrl('https://example.com/app.apk')).toBe(false)
    expect(
      isAllowedReleaseUrl('https://github.com/someone-else/cooking-journal/releases/download/v1/app.apk'),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl('http://github.com/lizekun793-beep/cooking-journal/releases/download/v1/a.apk'),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl('https://github.com/lizekun793-beep/cooking-journal/archive/refs/heads/main.zip'),
    ).toBe(false)
    expect(isAllowedReleasePageUrl('https://github.com/lizekun793-beep/cooking-journal/issues/1')).toBe(false)
    expect(isAllowedReleaseUrl('javascript:alert(1)')).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://github.com.evil.example/lizekun793-beep/cooking-journal/releases/download/v1/a.apk',
      ),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://user:pass@github.com/lizekun793-beep/cooking-journal/releases/download/v1/a.apk',
      ),
    ).toBe(false)
  })

  it('rejects foreign or non-manifest CDN paths', () => {
    expect(
      isAllowedReleaseUrl(
        'https://cdn.jsdelivr.net/gh/other/cooking-journal@main/public/update.json',
      ),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://cdn.jsdelivr.net/gh/lizekun793-beep/cooking-journal@main/public/evil.apk',
      ),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://cdn.jsdelivr.net/gh/lizekun793-beep/cooking-journal@main/src/app-version.json',
      ),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://raw.githubusercontent.com/lizekun793-beep/cooking-journal/main/public/evil.apk',
      ),
    ).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://raw.githubusercontent.com/someone-else/cooking-journal/main/public/update.json',
      ),
    ).toBe(false)
  })

  it('does not treat a release html page as an APK download URL', () => {
    expect(isAllowedReleaseUrl(RELEASE_PAGE_LATEST)).toBe(false)
    expect(
      isAllowedReleaseUrl('https://github.com/lizekun793-beep/cooking-journal/releases/tag/v1.0.2'),
    ).toBe(false)
  })
})
