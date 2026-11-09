export const RELEASE_OWNER = 'lizekun793-beep'
export const RELEASE_REPO = 'cooking-journal'
export const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases/latest`
export const RELEASE_PAGE_LATEST = `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/latest`

/** Primary fallback when api.github.com is unreachable (jsDelivr mirrors main). */
export const UPDATE_MANIFEST_JSDELIVR = `https://cdn.jsdelivr.net/gh/${RELEASE_OWNER}/${RELEASE_REPO}@main/public/update.json`

/** Second fallback: raw file on GitHub. */
export const UPDATE_MANIFEST_RAW = `https://raw.githubusercontent.com/${RELEASE_OWNER}/${RELEASE_REPO}/main/public/update.json`

/** Ordered fallbacks after the GitHub Releases API path. */
export const UPDATE_MANIFEST_FALLBACKS = [UPDATE_MANIFEST_JSDELIVR, UPDATE_MANIFEST_RAW] as const

const PAGE_HOSTS = new Set(['github.com', 'www.github.com'])
const API_HOSTS = new Set(['api.github.com'])
const ASSET_HOSTS = new Set([
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-cloud.githubusercontent.com',
])
const RAW_HOSTS = new Set(['raw.githubusercontent.com'])

function pathnameParts(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function parseHttpsUrl(url: string): URL | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2000) return null
  const trimmed = url.trim()
  if (/[\u0000-\u001f]/.test(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.username || parsed.password) return null
  if (parsed.hash) return null
  return parsed
}

function isThisRepo(parts: string[], ownerIndex = 0): boolean {
  return parts[ownerIndex] === RELEASE_OWNER && parts[ownerIndex + 1] === RELEASE_REPO
}

function isJsdelivrHost(host: string): boolean {
  return host === 'cdn.jsdelivr.net' || host.endsWith('.jsdelivr.net')
}

/**
 * Only this repo's public/update.json on jsDelivr gh mirrors.
 * Path shape: /gh/{owner}/{repo}@{ref}/public/update.json
 */
function isAllowedJsdelivrUpdateManifest(parts: string[]): boolean {
  if (parts.length !== 5) return false
  if (parts[0] !== 'gh') return false
  if (parts[1] !== RELEASE_OWNER) return false
  const repoSpec = parts[2]
  const at = repoSpec.lastIndexOf('@')
  if (at <= 0) return false
  const repo = repoSpec.slice(0, at)
  const ref = repoSpec.slice(at + 1)
  if (repo !== RELEASE_REPO) return false
  if (!ref || !/^[A-Za-z0-9._/-]+$/.test(ref)) return false
  return parts[3] === 'public' && parts[4] === 'update.json'
}

/** raw.githubusercontent.com/owner/repo/ref/public/update.json */
function isAllowedRawUpdateManifest(parts: string[]): boolean {
  if (parts.length !== 5) return false
  if (!isThisRepo(parts, 0)) return false
  if (!/^[A-Za-z0-9._/-]+$/.test(parts[2])) return false
  return parts[3] === 'public' && parts[4] === 'update.json'
}

/**
 * HTTPS URLs for APK / version.json / update.json on this exact repo, plus official
 * GitHub release-asset redirect hosts. Arbitrary APK URLs are rejected.
 */
export function isAllowedReleaseUrl(url: string): boolean {
  const parsed = parseHttpsUrl(url)
  if (!parsed) return false
  const host = parsed.hostname.toLowerCase()
  const parts = pathnameParts(parsed.pathname)

  if (PAGE_HOSTS.has(host)) {
    if (parts.length < 5) return false
    if (!isThisRepo(parts)) return false
    if (parts[2] !== 'releases') return false
    if (parts[3] === 'download' && parts.length >= 5) return true
    if (parts[3] === 'latest' && parts[4] === 'download' && parts.length >= 6) return true
    return false
  }

  if (API_HOSTS.has(host)) {
    if (parts.length < 5) return false
    if (parts[0] !== 'repos' || !isThisRepo(parts, 1)) return false
    if (parts[3] !== 'releases') return false
    if (parts[4] === 'latest' && parts.length === 5) return true
    if (parts[4] === 'assets' && parts.length === 6 && /^[0-9]+$/.test(parts[5])) return true
    return false
  }

  if (ASSET_HOSTS.has(host)) {
    return parts.length >= 1
  }

  if (isJsdelivrHost(host)) {
    return isAllowedJsdelivrUpdateManifest(parts)
  }

  if (RAW_HOSTS.has(host)) {
    return isAllowedRawUpdateManifest(parts)
  }

  return false
}

/** GitHub html release pages for this repo (not archives or issues). */
export function isAllowedReleasePageUrl(url: string): boolean {
  const parsed = parseHttpsUrl(url)
  if (!parsed) return false
  const host = parsed.hostname.toLowerCase()
  if (!PAGE_HOSTS.has(host)) return false
  const parts = pathnameParts(parsed.pathname)
  if (parts.length < 3 || !isThisRepo(parts) || parts[2] !== 'releases') return false
  if (parts.length === 3) return true
  if (parts.length === 4 && parts[3] === 'latest') return true
  if (parts.length === 5 && parts[3] === 'tag' && /^[A-Za-z0-9._-]+$/.test(parts[4])) return true
  return false
}

export function assertAllowedReleaseUrl(url: string): string {
  if (!isAllowedReleaseUrl(url)) {
    throw new Error('blocked-url')
  }
  return url
}

export function releaseDownloadUrl(versionName: string, apkFile: string): string {
  const tag = /^v/i.test(versionName) ? versionName : `v${versionName}`
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/${tag}/${apkFile}`
}

export function releaseTagPageUrl(versionName: string): string {
  const tag = /^v/i.test(versionName) ? versionName : `v${versionName}`
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/tag/${tag}`
}
