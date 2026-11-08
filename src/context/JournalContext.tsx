import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { uid } from '../lib/dates'
import { backupFilename, shareOrDownloadBackup } from '../lib/journal/shareBackup'
import { journalStore } from '../lib/journal/runtime'
import type { JournalState } from '../lib/journal/types'
import { backupToJson, parseBackup } from '../lib/journal/validate'
import type { BgChoice, CustomBg, Recipe } from '../types'

const MAX_CUSTOM_BGS = 10

interface JournalContextValue {
  ready: boolean
  persistBlocked: boolean
  hydrateWarning: string | null
  saveError: string | null
  recipes: Recipe[]
  bg: BgChoice
  setBg: (bg: BgChoice) => void
  customBgs: CustomBg[]
  addCustomBg: (src: string) => void
  upsert: (recipe: Recipe) => void
  remove: (id: string) => void
  get: (id: string) => Recipe | undefined
  exportBackup: () => Promise<void>
  importBackupText: (raw: string, confirmed: boolean) => Promise<{ ok: true } | { ok: false; error: string }>
  parseBackupText: typeof parseBackup
}

const JournalContext = createContext<JournalContextValue | null>(null)

function toSaveMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return '保存失败，手帐还在当前页面。请稍后重试或先导出备份。'
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [persistBlocked, setPersistBlocked] = useState(false)
  const [hydrateWarning, setHydrateWarning] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [bg, setBgState] = useState<BgChoice>('default')
  const [customBgs, setCustomBgs] = useState<CustomBg[]>([])

  const recipesRef = useRef(recipes)
  const bgRef = useRef(bg)
  const customRef = useRef(customBgs)
  recipesRef.current = recipes
  bgRef.current = bg
  customRef.current = customBgs

  useEffect(() => {
    let cancelled = false
    void journalStore()
      .hydrate()
      .then((result) => {
        if (cancelled) return
        setRecipes(result.state.recipes)
        setBgState(result.state.bg)
        setCustomBgs(result.state.customBgs)
        setPersistBlocked(result.persistBlocked)
        setHydrateWarning(result.warning ?? null)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setPersistBlocked(true)
        setHydrateWarning(toSaveMessage(err))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: JournalState) => {
    try {
      await journalStore().save(next)
      setSaveError(null)
      setPersistBlocked(false)
    } catch (err) {
      setSaveError(toSaveMessage(err))
    }
  }, [])

  const setBg = useCallback(
    (next: BgChoice) => {
      setBgState(next)
      void persist({ recipes: recipesRef.current, bg: next, customBgs: customRef.current })
    },
    [persist],
  )

  const addCustomBg = useCallback(
    (src: string) => {
      const id = uid('bg')
      const nextBgs = [...customRef.current, { id, src }].slice(-MAX_CUSTOM_BGS)
      setCustomBgs(nextBgs)
      setBgState(id)
      void persist({ recipes: recipesRef.current, bg: id, customBgs: nextBgs })
    },
    [persist],
  )

  const upsert = useCallback(
    (recipe: Recipe) => {
      setRecipes((prev) => {
        const idx = prev.findIndex((r) => r.id === recipe.id)
        const next = idx >= 0 ? prev.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...prev]
        void persist({ recipes: next, bg: bgRef.current, customBgs: customRef.current })
        return next
      })
    },
    [persist],
  )

  const remove = useCallback(
    (id: string) => {
      setRecipes((prev) => {
        const next = prev.filter((r) => r.id !== id)
        void persist({ recipes: next, bg: bgRef.current, customBgs: customRef.current })
        return next
      })
    },
    [persist],
  )

  const get = useCallback((id: string) => recipes.find((r) => r.id === id), [recipes])

  const exportBackup = useCallback(async () => {
    const json = backupToJson(
      {
        recipes: recipesRef.current,
        bg: bgRef.current,
        customBgs: customRef.current,
      },
      new Date().toISOString(),
    )
    await shareOrDownloadBackup(json, backupFilename())
  }, [])

  const importBackupText = useCallback(
    async (raw: string, confirmed: boolean): Promise<{ ok: true } | { ok: false; error: string }> => {
      const result = await journalStore().importBackup(raw, confirmed)
      if (!result.ok) return result
      setRecipes(result.data.recipes)
      setBgState(result.data.bg)
      setCustomBgs(result.data.customBgs)
      setPersistBlocked(false)
      setHydrateWarning(null)
      setSaveError(null)
      return { ok: true }
    },
    [],
  )

  const value = useMemo(
    () => ({
      ready,
      persistBlocked,
      hydrateWarning,
      saveError,
      recipes,
      bg,
      setBg,
      customBgs,
      addCustomBg,
      upsert,
      remove,
      get,
      exportBackup,
      importBackupText,
      parseBackupText: parseBackup,
    }),
    [
      ready,
      persistBlocked,
      hydrateWarning,
      saveError,
      recipes,
      bg,
      setBg,
      customBgs,
      addCustomBg,
      upsert,
      remove,
      get,
      exportBackup,
      importBackupText,
    ],
  )

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext)
  if (!ctx) throw new Error('useJournal must be used within JournalProvider')
  return ctx
}
