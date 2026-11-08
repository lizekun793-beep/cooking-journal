import { Browser } from '@capacitor/browser'
import { isNativeApp } from '../platform'
import { isAllowedReleasePageUrl, isAllowedReleaseUrl } from './urls'

export type OpenResult = 'opened' | 'blocked' | 'failed'

export type OpenUrlDeps = {
  native: boolean
  openNative: (url: string) => Promise<void>
  openWeb: (url: string) => Window | null
}

function defaultDeps(): OpenUrlDeps {
  return {
    native: isNativeApp(),
    openNative: (url) => Browser.open({ url }),
    openWeb: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  }
}

export async function openApprovedUrl(
  url: string,
  kind: 'download' | 'page',
  deps: OpenUrlDeps = defaultDeps(),
): Promise<OpenResult> {
  const allowed = kind === 'download' ? isAllowedReleaseUrl(url) : isAllowedReleasePageUrl(url)
  if (!allowed) return 'blocked'
  try {
    if (deps.native) {
      await deps.openNative(url)
      return 'opened'
    }
    const win = deps.openWeb(url)
    return win ? 'opened' : 'failed'
  } catch {
    return 'failed'
  }
}
