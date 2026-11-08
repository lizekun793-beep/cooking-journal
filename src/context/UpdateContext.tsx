import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useJournal } from './JournalContext'
import { readRuntimeVersion } from '../lib/runtimeVersion'
import { checkLatestRelease, type ReleaseCheck } from '../lib/updates/check'
import { openApprovedUrl } from '../lib/updates/openUrl'
import {
  deriveEntry,
  deriveSheet,
  type InstalledVersion,
  type SheetView,
} from '../lib/updates/presentation'
import { RELEASE_PAGE_LATEST } from '../lib/updates/urls'

interface UpdateContextValue {
  installed: InstalledVersion | null
  last: ReleaseCheck | null
  checking: boolean
  failed: boolean
  download: 'idle' | 'opened' | 'failed'
  entry: ReturnType<typeof deriveEntry>
  sheet: SheetView
  checkUpdates: () => Promise<void>
  startUpdateDownload: () => Promise<void>
  openReleasePage: () => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

export function UpdateProvider({ children }: { children: ReactNode }) {
  const { ready } = useJournal()
  const [installed, setInstalled] = useState<InstalledVersion | null>(null)
  const [checking, setChecking] = useState(false)
  const [last, setLast] = useState<ReleaseCheck | null>(null)
  const [failed, setFailed] = useState(false)
  const [download, setDownload] = useState<'idle' | 'opened' | 'failed'>('idle')

  useEffect(() => {
    let cancelled = false
    void readRuntimeVersion().then((info) => {
      if (!cancelled) setInstalled(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const runCheck = useCallback(
    async (silent: boolean) => {
      if (!installed) return
      setChecking(true)
      if (!silent) setDownload('idle')
      try {
        const result = await checkLatestRelease({ localVersionCode: installed.versionCode })
        if (result.status === 'unavailable') {
          if (!silent) setFailed(true)
          return
        }
        setFailed(false)
        setLast(result)
      } catch {
        if (!silent) setFailed(true)
      } finally {
        setChecking(false)
      }
    },
    [installed],
  )

  useEffect(() => {
    if (!ready || !installed) return
    void runCheck(true)
  }, [ready, installed, runCheck])

  const checkUpdates = useCallback(async () => {
    await runCheck(false)
  }, [runCheck])

  const startUpdateDownload = useCallback(async () => {
    if (last?.status !== 'update-available' || !last.apkUrl) return
    const result = await openApprovedUrl(last.apkUrl, 'download')
    setDownload(result === 'opened' ? 'opened' : 'failed')
  }, [last])

  const openReleasePage = useCallback(async () => {
    const url = last && 'htmlUrl' in last && last.htmlUrl ? last.htmlUrl : RELEASE_PAGE_LATEST
    await openApprovedUrl(url, 'page')
  }, [last])

  const entry = useMemo(() => deriveEntry(installed, last), [installed, last])
  const sheet = useMemo(
    () => deriveSheet({ checking, last, failed, download }),
    [checking, last, failed, download],
  )

  const value = useMemo(
    () => ({
      installed,
      last,
      checking,
      failed,
      download,
      entry,
      sheet,
      checkUpdates,
      startUpdateDownload,
      openReleasePage,
    }),
    [
      installed,
      last,
      checking,
      failed,
      download,
      entry,
      sheet,
      checkUpdates,
      startUpdateDownload,
      openReleasePage,
    ],
  )

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}

export function useAppUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useAppUpdate must be used within UpdateProvider')
  return ctx
}
