import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'))
}

const meta = readJson('src/app-version.json')
const pkg = readJson('package.json')
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

if (errors.length) {
  for (const line of errors) console.error(line)
  process.exit(1)
}

console.log(`version ok: ${meta.appId} ${meta.versionName} (${meta.versionCode})`)
