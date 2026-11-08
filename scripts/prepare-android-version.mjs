import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const meta = JSON.parse(readFileSync(join(root, 'src/app-version.json'), 'utf8'))
const gradle = join(root, 'android/app/build.gradle')

if (!existsSync(gradle)) {
  console.log('android/app/build.gradle not found yet. Run `npx cap add android` first.')
  process.exit(0)
}

let text = readFileSync(gradle, 'utf8')
const before = text
text = text.replace(/applicationId\s+"[^"]+"/, `applicationId "${meta.appId}"`)
text = text.replace(/namespace\s+"[^"]+"/, `namespace "${meta.appId}"`)
text = text.replace(/versionCode\s+\d+/, `versionCode ${meta.versionCode}`)
text = text.replace(/versionName\s+"[^"]+"/, `versionName "${meta.versionName}"`)

if (text === before) {
  console.log('prepare-android-version: no gradle fields changed (check android/app/build.gradle by hand).')
} else {
  writeFileSync(gradle, text)
  console.log(`patched android/app/build.gradle -> ${meta.appId} ${meta.versionName} (${meta.versionCode})`)
}

const strings = join(root, 'android/app/src/main/res/values/strings.xml')
if (existsSync(strings)) {
  let xml = readFileSync(strings, 'utf8')
  xml = xml.replace(
    /<string name="app_name">[^<]*<\/string>/,
    `<string name="app_name">${meta.appName}</string>`,
  )
  xml = xml.replace(
    /<string name="title_activity_main">[^<]*<\/string>/,
    `<string name="title_activity_main">${meta.appName}</string>`,
  )
  xml = xml.replace(
    /<string name="package_name">[^<]*<\/string>/,
    `<string name="package_name">${meta.appId}</string>`,
  )
  xml = xml.replace(
    /<string name="custom_url_scheme">[^<]*<\/string>/,
    `<string name="custom_url_scheme">${meta.appId}</string>`,
  )
  writeFileSync(strings, xml)
}
