import { defaultHttpGet, type HttpGet } from './http'
import {
  LATEST_RELEASE_API,
  UPDATE_MANIFEST_FALLBACKS,
  isAllowedReleasePageUrl,
  isAllowedReleaseUrl,
  releaseDownloadUrl,
  releaseTagPageUrl,
} from './urls'
import { compareVersionCode, parseVersionJson, type VersionJson } from './version'

export const DEFAULT_CHECK_TIMEOUT_MS = 8000

export type ReleaseInfo = {
  versionName: string
  versionCode: number
  notes: string | null
  htmlUrl: string | null
  apkUrl: string | null
}

export type ReleaseCheck =
  | ({ status: 'update-available' } & ReleaseInfo)
  | ({ status: 'up-to-date' } & ReleaseInfo)
  | ({ status: 'local-newer' } & ReleaseInfo)
  | { status: 'no-release' }
  | { status: 'unavailable'; reason: string }

type GithubAsset = {
  name?: string
  url?: string
  browser_download_url?: string
}

type GithubRelease = {
  tag_name?: string
  body?: string | null
  html_url?: string
  assets?: GithubAsset[]
}

type HttpGetResultLike = { status: number; body: string; url?: string }

function pickAsset(assets: GithubAsset[], predicate: (name: string) => boolean): GithubAsset | undefined {
  return assets.find((a) => typeof a.name === 'string' && predicate(a.name))
}

function assetFetchUrl(asset: GithubAsset): string | null {
  const apiUrl = typeof asset.url === 'string' ? asset.url : ''
  if (apiUrl && isAllowedReleaseUrl(apiUrl)) return apiUrl
  const browser = typeof asset.browser_download_url === 'string' ? asset.browser_download_url : ''
  if (browser && isAllowedReleaseUrl(browser)) return browser
  return null
}

function apkUrlFrom(release: GithubRelease, version: { apkFile?: string; apkUrl?: string }): string | null {
  if (version.apkUrl) {
    return isAllowedReleaseUrl(version.apkUrl) ? version.apkUrl : null
  }
  const assets = Array.isArray(release.assets) ? release.assets : []
  const byName = version.apkFile
    ? pickAsset(assets, (name) => name === version.apkFile)
    : undefined
  const apk = byName ?? pickAsset(assets, (name) => name.toLowerCase().endsWith('.apk'))
  if (!apk) return null
  const browser = typeof apk.browser_download_url === 'string' ? apk.browser_download_url : ''
  if (browser && isAllowedReleaseUrl(browser)) return browser
  return null
}

export function readReleaseNotes(body: unknown): string | null {
  if (typeof body !== 'string') return null
  const text = body.replace(/\r\n/g, '\n').trim()
  return text.length > 0 ? text : null
}

export function allowedHtmlUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  return isAllowedReleasePageUrl(url) ? url : null
}

function infoFrom(release: GithubRelease, version: ReleaseInfo): ReleaseInfo {
  return {
    versionName: version.versionName,
    versionCode: version.versionCode,
    notes: version.notes,
    htmlUrl: version.htmlUrl ?? allowedHtmlUrl(release.html_url),
    apkUrl: version.apkUrl,
  }
}

function resolveApkUrl(version: VersionJson): string | null {
  if (version.apkUrl && isAllowedReleaseUrl(version.apkUrl)) return version.apkUrl
  if (version.apkFile) {
    const built = releaseDownloadUrl(version.versionName, version.apkFile)
    return isAllowedReleaseUrl(built) ? built : null
  }
  return null
}

function releaseInfoFromManifest(version: VersionJson): ReleaseInfo {
  return {
    versionName: version.versionName,
    versionCode: version.versionCode,
    notes: readReleaseNotes(version.notes ?? null),
    htmlUrl: allowedHtmlUrl(version.htmlUrl) ?? allowedHtmlUrl(releaseTagPageUrl(version.versionName)),
    apkUrl: resolveApkUrl(version),
  }
}

function compareToCheck(localVersionCode: number, info: ReleaseInfo): ReleaseCheck {
  let cmp: ReturnType<typeof compareVersionCode>
  try {
    cmp = compareVersionCode(localVersionCode, info.versionCode)
  } catch {
    return { status: 'unavailable', reason: 'invalid-version-code' }
  }
  if (cmp === 'up-to-date' || cmp === 'local-newer') {
    return { status: cmp, ...info }
  }
  return { status: 'update-available', ...info }
}

function classifyHttpError(err: unknown): ReleaseCheck {
  const msg = err instanceof Error ? err.message : 'network'
  if (msg === 'timeout') return { status: 'unavailable', reason: 'timeout' }
  if (msg === 'blocked-url' || msg === 'blocked-redirect') {
    return { status: 'unavailable', reason: msg }
  }
  return { status: 'unavailable', reason: 'network' }
}

async function checkViaGithubRelease(opts: {
  localVersionCode: number
  httpGet: HttpGet
  timeoutMs: number
}): Promise<ReleaseCheck> {
  let latest: HttpGetResultLike
  try {
    latest = await opts.httpGet(LATEST_RELEASE_API, {
      timeoutMs: opts.timeoutMs,
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })
  } catch (err) {
    return classifyHttpError(err)
  }

  if (latest.status === 404) return { status: 'no-release' }
  if (latest.status < 200 || latest.status >= 300) {
    return { status: 'unavailable', reason: `http-${latest.status}` }
  }

  let release: GithubRelease
  try {
    release = JSON.parse(latest.body) as GithubRelease
  } catch {
    return { status: 'unavailable', reason: 'invalid-release-json' }
  }

  const assets = Array.isArray(release.assets) ? release.assets : []
  const versionAsset = pickAsset(assets, (name) => name === 'version.json')
  if (!versionAsset) return { status: 'no-release' }

  const versionUrl = assetFetchUrl(versionAsset)
  if (!versionUrl) return { status: 'no-release' }

  let versionRes: HttpGetResultLike
  try {
    versionRes = await opts.httpGet(versionUrl, {
      timeoutMs: opts.timeoutMs,
      headers: {
        Accept: 'application/octet-stream, application/json',
      },
    })
  } catch (err) {
    return classifyHttpError(err)
  }

  if (versionRes.status === 404) return { status: 'no-release' }
  if (versionRes.status < 200 || versionRes.status >= 300) {
    return { status: 'unavailable', reason: `http-${versionRes.status}` }
  }

  const parsed = parseVersionJson(versionRes.body)
  if (!parsed.ok) return { status: 'unavailable', reason: parsed.error }

  const info: ReleaseInfo = {
    versionName: parsed.data.versionName,
    versionCode: parsed.data.versionCode,
    notes: readReleaseNotes(release.body),
    htmlUrl: allowedHtmlUrl(release.html_url),
    apkUrl: apkUrlFrom(release, parsed.data),
  }

  return compareToCheck(opts.localVersionCode, infoFrom(release, info))
}

async function checkViaUpdateManifest(opts: {
  localVersionCode: number
  httpGet: HttpGet
  timeoutMs: number
  manifestUrl: string
}): Promise<ReleaseCheck> {
  let res: HttpGetResultLike
  try {
    res = await opts.httpGet(opts.manifestUrl, {
      timeoutMs: opts.timeoutMs,
      headers: {
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return classifyHttpError(err)
  }

  if (res.status === 404) return { status: 'no-release' }
  if (res.status < 200 || res.status >= 300) {
    return { status: 'unavailable', reason: `http-${res.status}` }
  }

  const parsed = parseVersionJson(res.body)
  if (!parsed.ok) return { status: 'unavailable', reason: parsed.error }

  return compareToCheck(opts.localVersionCode, releaseInfoFromManifest(parsed.data))
}

export async function checkLatestRelease(opts: {
  localVersionCode: number
  httpGet?: HttpGet
  timeoutMs?: number
  /** Override fallbacks in tests. Defaults to jsDelivr then raw.githubusercontent.com. */
  manifestFallbacks?: readonly string[]
}): Promise<ReleaseCheck> {
  const httpGet = opts.httpGet ?? defaultHttpGet
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS
  const fallbacks = opts.manifestFallbacks ?? UPDATE_MANIFEST_FALLBACKS

  const primary = await checkViaGithubRelease({
    localVersionCode: opts.localVersionCode,
    httpGet,
    timeoutMs,
  })
  if (primary.status !== 'unavailable') return primary

  let last: ReleaseCheck = primary
  for (const manifestUrl of fallbacks) {
    const next = await checkViaUpdateManifest({
      localVersionCode: opts.localVersionCode,
      httpGet,
      timeoutMs,
      manifestUrl,
    })
    if (next.status !== 'unavailable') return next
    last = next
  }
  return last
}
