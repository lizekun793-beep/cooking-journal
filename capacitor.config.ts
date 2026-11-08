import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Bundled local app. `server.url` is intentionally omitted so Android
 * loads `webDir` assets instead of a remote site.
 */
const config: CapacitorConfig = {
  appId: 'cn.kitchenjournal.app',
  appName: '做菜手帐',
  webDir: 'dist',
  backgroundColor: '#F6EBDA',
  android: {
    allowMixedContent: false,
    backgroundColor: '#F6EBDA',
  },
  plugins: {
    App: {
      disableBackButtonHandler: false,
    },
  },
}

export default config
