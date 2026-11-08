/**
 * Publish APK + version.json as a GitHub Release on the same repository.
 * Uses GITHUB_TOKEN (Actions contents:write). Does not read DIST_GITHUB_TOKEN
 * and does not publish to another repo.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY || 'lizekun793-beep/cooking-journal'
const apkPath = process.env.DIST_APK_PATH
const versionPath = process.env.DIST_VERSION_JSON_PATH

if (!token) {
  console.log(
    'Skipping GitHub Release publish: GITHUB_TOKEN is not set. This script is meant for GitHub Actions on the same repo.',
  )
  process.exit(0)
}

if (!apkPath || !versionPath) {
  console.error('DIST_APK_PATH and DIST_VERSION_JSON_PATH are required.')
  process.exit(1)
}

const version = JSON.parse(readFileSync(versionPath, 'utf8'))
let tag = process.env.DIST_TAG || process.env.GITHUB_REF_NAME || ''
if (!/^v\d/.test(tag)) tag = `v${version.versionName}`

const apk = readFileSync(apkPath)
const apkName = basename(apkPath)
const versionBody = readFileSync(versionPath)

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'cooking-journal-release-script',
}

async function gh(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const error = new Error(`GitHub ${res.status} ${url}: ${text.slice(0, 400)}`)
    error.status = res.status
    error.json = json
    throw error
  }
  return json
}

async function getOrCreateRelease() {
  try {
    return await gh(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`)
  } catch (err) {
    if (err && err.status !== 404) throw err
  }
  return gh(`https://api.github.com/repos/${repo}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: version.versionName,
      body: version.notes || `做菜手帐 Android ${version.versionName} (versionCode ${version.versionCode})`,
      draft: false,
      prerelease: false,
    }),
  })
}

const release = await getOrCreateRelease()
const uploadUrl = String(release.upload_url).replace(/\{.*\}$/, '')
const existing = Array.isArray(release.assets) ? release.assets : []

async function upload(name, data, contentType) {
  const prior = existing.find((a) => a && a.name === name)
  if (prior && prior.id) {
    await gh(`https://api.github.com/repos/${repo}/releases/assets/${prior.id}`, { method: 'DELETE' })
  }
  const url = `${uploadUrl}?name=${encodeURIComponent(name)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': contentType,
    },
    body: data,
  })
  if (!res.ok) {
    throw new Error(`upload ${name} failed: ${res.status} ${await res.text()}`)
  }
}

await upload(apkName, apk, 'application/vnd.android.package-archive')
await upload('version.json', versionBody, 'application/json')
console.log(`published ${apkName} and version.json to ${repo} ${release.html_url}`)
