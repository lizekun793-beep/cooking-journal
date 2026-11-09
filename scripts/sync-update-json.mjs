/**
 * Keep public/update.json aligned with src/app-version.json.
 * APK download URL always points at this repo's GitHub Releases.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const meta = JSON.parse(readFileSync(join(root, 'src/app-version.json'), 'utf8'))
const versionName = meta.versionName
const versionCode = meta.versionCode
const apkFile = `kitchen-journal-${versionName}.apk`
const tag = `v${versionName}`
const owner = 'lizekun793-beep'
const repo = 'cooking-journal'

let notes = `做菜手帐 Android ${versionName} (versionCode ${versionCode})`
const existingPath = join(root, 'public/update.json')
try {
  const prev = JSON.parse(readFileSync(existingPath, 'utf8'))
  if (typeof prev.notes === 'string' && prev.notes.trim() && prev.versionName === versionName) {
    notes = prev.notes.trim()
  }
} catch {
  // first write
}

const doc = {
  versionName,
  versionCode,
  apkFile,
  apkUrl: `https://github.com/${owner}/${repo}/releases/download/${tag}/${apkFile}`,
  htmlUrl: `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
  notes,
}

mkdirSync(join(root, 'public'), { recursive: true })
writeFileSync(existingPath, `${JSON.stringify(doc, null, 2)}\n`)
console.log(`wrote public/update.json -> ${versionName} (${versionCode})`)
