import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from './platform'

export const ANDROID_BACK_EVENT = 'kitchen-journal:back'

export function installAndroidBackHandler(): () => void {
  if (!isNativeApp()) return () => undefined

  let removed = false
  let handle: PluginListenerHandle | undefined

  void App.addListener('backButton', ({ canGoBack }) => {
    const ev = new CustomEvent(ANDROID_BACK_EVENT, { cancelable: true })
    window.dispatchEvent(ev)
    if (ev.defaultPrevented) return
    if (canGoBack) {
      window.history.back()
      return
    }
    void App.exitApp()
  }).then((h) => {
    if (removed) void h.remove()
    else handle = h
  })

  return () => {
    removed = true
    void handle?.remove()
  }
}
