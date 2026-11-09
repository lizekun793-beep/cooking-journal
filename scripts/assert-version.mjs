import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'))
}

const meta = readJson('src/app-version.json')
const pkg = readJson('package.json')
const update = readJson('public/update.json')
const cap = readFileSync(join(root, 'capacitor.config.ts'), 'utf8')

const errors = []
if (pkg.version !== meta.versionName) {
  errors.push(`package.json version ${pkg.version} != app-version versionName ${meta.versionName}`)
}
if (!Number.isInteger(meta.versionCode) || meta.versionCode < 1) {
  errors.push(`versionCode must be an integer >= 1, got ${meta.versionCode}`)
}
if (meta.appId !== 'cn.kitchenjournal.app') {
  errors.push(`appId must stay cn.kitchenjournal.app, got ${meta.appId}`)
}
if (!cap.includes(`appId: '${meta.appId}'`) && !cap.includes(`appId: "${meta.appId}"`)) {
  errors.push('capacitor.config.ts appId does not match src/app-version.json')
}

const expectedApk = `kitchen-journal-${meta.versionName}.apk`
const expectedApkUrl = `https://github.com/lizekun793-beep/cooking-journal/releases/download/v${meta.versionName}/${expectedApk}`
const expectedHtml = `https://github.com/lizekun793-beep/cooking-journal/releases/tag/v${meta.versionName}`

if (update.versionName !== meta.versionName) {
  errors.push(`public/update.json versionName ${update.versionName} != ${meta.versionName}`)
}
if (update.versionCode !== meta.versionCode) {
  errors.push(`public/update.json versionCode ${update.versionCode} != ${meta.versionCode}`)
}
if (update.apkFile !== expectedApk) {
  errors.push(`public/update.json apkFile ${update.apkFile} != ${expectedApk}`)
}
if (update.apkUrl !== expectedApkUrl) {
  errors.push(`public/update.json apkUrl mismatch`)
}
if (update.htmlUrl !== expectedHtml) {
  errors.push(`public/update.json htmlUrl mismatch`)
}

if (errors.length) {
  for (const line of errors) console.error(line)
  process.exit(1)
}

console.log(`version ok: ${meta.appId} ${meta.versionName} (${meta.versionCode}); update.json aligned`)
