import { App } from '@capacitor/app'
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../appVersion'
import { isNativeApp } from './platform'
import type { InstalledVersion } from './updates/presentation'
import { parseVersionCode } from './updates/version'

export type RuntimeVersionDeps = {
  native: boolean
  getInfo: () => Promise<{ version?: string; build?: string }>
}

export async function readRuntimeVersion(
  deps?: RuntimeVersionDeps,
): Promise<InstalledVersion> {
  const native = deps?.native ?? isNativeApp()
  if (native) {
    try {
      const info = await (deps?.getInfo ?? (() => App.getInfo()))()
      const code = parseVersionCode(info.build) ?? APP_VERSION_CODE
      const versionName = info.version?.trim() || APP_VERSION_NAME
      return { versionName, versionCode: code, channel: 'android' }
    } catch {
      return { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, channel: 'android' }
    }
  }
  return { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, channel: 'web' }
}
