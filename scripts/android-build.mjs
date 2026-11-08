import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(process.execPath, [join(root, 'scripts/assert-version.mjs')])

if (!existsSync(join(root, 'android'))) {
  console.log(`
Android project is not generated yet.
Next:
  1. npm test && npm run build
  2. npx cap add android
  3. node scripts/prepare-android-version.mjs
  4. npx cap sync android
  5. With JDK 21 + Android SDK: cd android && ./gradlew assembleRelease
`.trim())
  process.exit(0)
}

run(process.execPath, [join(root, 'scripts/prepare-android-version.mjs')])
console.log('Version fields patched. Build the APK with the Android SDK (see docs/android.md).')
