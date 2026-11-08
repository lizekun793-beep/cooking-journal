import { describe, expect, it } from 'vitest'
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../appVersion'
import { readRuntimeVersion } from './runtimeVersion'

describe('readRuntimeVersion', () => {
  it('uses App.getInfo version and build on Android', async () => {
    const info = await readRuntimeVersion({
      native: true,
      getInfo: async () => ({ version: '1.2.3', build: '7' }),
    })
    expect(info).toEqual({ versionName: '1.2.3', versionCode: 7, channel: 'android' })
  })

  it('marks the web channel so the UI cannot pretend it is an APK', async () => {
    const info = await readRuntimeVersion({
      native: false,
      getInfo: async () => {
        throw new Error('App.getInfo must not run on web')
      },
    })
    expect(info.channel).toBe('web')
    expect(info.versionName).toBe(APP_VERSION_NAME)
    expect(info.versionCode).toBe(APP_VERSION_CODE)
    expect(info.versionName).not.toMatch(/placeholder|x\.x\.x|待定/i)
  })

  it('falls back to the bundled Android version when getInfo fails', async () => {
    const info = await readRuntimeVersion({
      native: true,
      getInfo: async () => {
        throw new Error('plugin missing')
      },
    })
    expect(info).toEqual({
      versionName: APP_VERSION_NAME,
      versionCode: APP_VERSION_CODE,
      channel: 'android',
    })
  })
})
