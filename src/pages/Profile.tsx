import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { InkTag } from '../components/InkTag'
import { useAppUpdate } from '../context/UpdateContext'
import { useJournal } from '../context/JournalContext'
import { ANDROID_BACK_EVENT } from '../lib/backButton'
import { dateStamp, formatRelative, isThisWeek } from '../lib/dates'
import { readImageAsDataUrl } from '../lib/images'
import { COPY } from '../lib/updates/presentation'
import { BG_DEFAULT, BG_MALE, resolveBgSrc, type Recipe } from '../types'

type SheetKey = 'signature' | 'retry' | 'loved' | 'tags' | 'update'

function isSignature(r: Recipe): boolean {
  return r.isSignature || r.tags.some((t) => t.label === '拿手')
}

function isRetry(r: Recipe): boolean {
  return r.toRetry || r.tags.some((t) => t.label === '待复刻')
}

function matchesQuery(r: Recipe, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  if (r.name.toLowerCase().includes(s)) return true
  if (r.tags.some((t) => t.label.toLowerCase().includes(s))) return true
  if (r.pits.some((p) => p.toLowerCase().includes(s))) return true
  return false
}

function DishRow({ recipe, onOpen }: { recipe: Recipe; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="dish" onClick={() => onOpen(recipe.id)}>
      <div className={`thumb ${recipe.photos[0] ? '' : 'ph'}`}>
        {recipe.photos[0] ? <img src={recipe.photos[0]} alt="" /> : '🍽'}
      </div>
      <div className="body">
        <h4>{recipe.name}</h4>
        <div className="sub">
          {formatRelative(recipe.cookedAt)} · {recipe.duration} · 做过 {recipe.timesCooked} 次
        </div>
      </div>
      <div className="marks">
        {recipe.tags.slice(0, 2).map((t) => (
          <InkTag key={t.label} label={t.label} kind={t.kind} />
        ))}
      </div>
    </button>
  )
}

export function Profile() {
  const {
    recipes,
    bg,
    setBg,
    customBgs,
    addCustomBg,
    saveError,
    hydrateWarning,
    persistBlocked,
    exportBackup,
    importBackupText,
    parseBackupText,
  } = useJournal()
  const { entry, sheet: updateSheet, checkUpdates, startUpdateDownload, openReleasePage } =
    useAppUpdate()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const updateLayerRef = useRef<HTMLDivElement>(null)
  const stamp = dateStamp()

  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<SheetKey | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [ioMessage, setIoMessage] = useState<string | null>(null)
  const [ioBusy, setIoBusy] = useState(false)

  useLayoutEffect(() => {
    const el = document.querySelector('.phone')
    setHost(el instanceof HTMLElement ? el : null)
  }, [])

  useEffect(() => {
    if (sheet !== 'update') return
    const closeBtn = updateLayerRef.current?.querySelector<HTMLElement>('.close')
    closeBtn?.focus()
  }, [sheet])

  useEffect(() => {
    if (!sheet) return
    const scroller = document.querySelector('.phone-scroll') as HTMLElement | null
    const prev = scroller?.style.overflowY
    if (scroller) scroller.style.overflowY = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (tagFilter) setTagFilter(null)
      else setSheet(null)
    }
    const onHardwareBack = (e: Event) => {
      e.preventDefault()
      if (tagFilter) setTagFilter(null)
      else setSheet(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(ANDROID_BACK_EVENT, onHardwareBack)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(ANDROID_BACK_EVENT, onHardwareBack)
      if (scroller) scroller.style.overflowY = prev ?? ''
    }
  }, [sheet, tagFilter])

  const published = useMemo(() => recipes.filter((r) => !r.isDraft), [recipes])
  const signature = useMemo(() => published.filter(isSignature), [published])
  const retry = useMemo(() => published.filter(isRetry), [published])
  const loved = useMemo(() => published.filter((r) => r.loved), [published])
  const weekCount = useMemo(
    () => published.filter((r) => isThisWeek(r.cookedAt)).length,
    [published],
  )
  const tagStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of published) {
      for (const t of r.tags) {
        map.set(t.label, (map.get(t.label) ?? 0) + 1)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
  }, [published])

  const hero = resolveBgSrc(bg, customBgs)

  function openSheet(key: SheetKey) {
    setTagFilter(null)
    setSheet(key)
  }

  function closeSheet() {
    setTagFilter(null)
    setSheet(null)
  }

  function onBack() {
    if (tagFilter) setTagFilter(null)
    else setSheet(null)
  }

  async function onPickBg(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const src = await readImageAsDataUrl(file, 1200, 0.82)
      addCustomBg(src)
    } catch {
      /* skip unreadable files */
    }
  }

  async function onExport() {
    setIoBusy(true)
    setIoMessage(null)
    try {
      await exportBackup()
      setIoMessage('备份已准备好。')
    } catch {
      setIoMessage('导出失败，请稍后重试。')
    } finally {
      setIoBusy(false)
    }
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setIoBusy(true)
    setIoMessage(null)
    try {
      const text = await file.text()
      const parsed = parseBackupText(text)
      if (!parsed.ok) {
        setIoMessage(`${parsed.error} 现有手帐未改动。`)
        return
      }
      const ok = window.confirm(
        `导入会替换当前手帐（备份含 ${parsed.data.recipes.length} 道菜）。现有数据会先另存一份恢复副本。确定导入？`,
      )
      if (!ok) {
        setIoMessage('已取消导入。')
        return
      }
      const result = await importBackupText(text, true)
      if (!result.ok) {
        setIoMessage(`${result.error} 现有手帐未改动。`)
        return
      }
      setIoMessage('导入完成。')
    } catch {
      setIoMessage('无法读取该文件，现有手帐未改动。')
    } finally {
      setIoBusy(false)
    }
  }

  function onUpdateAction(action: typeof updateSheet.primary.action) {
    if (action === 'check' || action === 'retry') void checkUpdates()
    else if (action === 'download') void startUpdateDownload()
    else if (action === 'later') closeSheet()
    else if (action === 'release-page') void openReleasePage()
  }

  function trapUpdateFocus(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const root = e.currentTarget
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea'),
    )
    if (nodes.length === 0) {
      e.preventDefault()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const q = query.trim().toLowerCase()
  const visibleTags = (() => {
    if (!q) return tagStats
    const byLabel = tagStats.filter(([label]) => label.toLowerCase().includes(q))
    if (byLabel.length) return byLabel
    const fromDishes = new Set(
      published.filter((r) => matchesQuery(r, query)).flatMap((r) => r.tags.map((t) => t.label)),
    )
    return tagStats.filter(([label]) => fromDishes.has(label))
  })()

  let sheetTitle = ''
  let sheetCount = ''
  let sheetDishes: Recipe[] = []
  const showingTags = sheet === 'tags' && !tagFilter

  if (sheet === 'signature') {
    sheetTitle = '拿手菜'
    sheetDishes = signature.filter((r) => matchesQuery(r, query))
    sheetCount = `${sheetDishes.length} 道`
  } else if (sheet === 'retry') {
    sheetTitle = '待复刻'
    sheetDishes = retry.filter((r) => matchesQuery(r, query))
    sheetCount = `${sheetDishes.length} 道`
  } else if (sheet === 'loved') {
    sheetTitle = '已收藏'
    sheetDishes = loved.filter((r) => matchesQuery(r, query))
    sheetCount = `${sheetDishes.length} 道`
  } else if (sheet === 'tags' && tagFilter) {
    sheetTitle = tagFilter
    sheetDishes = published.filter(
      (r) => r.tags.some((t) => t.label === tagFilter) && matchesQuery(r, query),
    )
    sheetCount = `${sheetDishes.length} 道`
  } else if (showingTags) {
    sheetTitle = '全部标签'
    sheetCount = `${visibleTags.length} 个`
  }

  const updateOverlay = (
    <div
      className="update-layer"
      ref={updateLayerRef}
      onKeyDown={trapUpdateFocus}
    >
      <div className="scrim" onClick={closeSheet} />
      <div className="sheet2 update-sheet" role="dialog" aria-modal="true" aria-label={updateSheet.title}>
        <div className="handle" />
        <div className="sheet2-head">
          <h3>{updateSheet.title}</h3>
          <button type="button" className="close" onClick={closeSheet} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="update-sheet-scroll">
          {updateSheet.stale ? <p className="update-stale">{COPY.stale}</p> : null}
          <h4 className={`update-heading ${updateSheet.headingTone}`}>
            {updateSheet.headingTone === 'ok' ? (
              <span className="ok-ico" aria-hidden="true">
                ✓
              </span>
            ) : null}
            {updateSheet.heading}
          </h4>
          {updateSheet.body ? <p className="update-body">{updateSheet.body}</p> : null}
          {updateSheet.noApk ? <p className="update-body">{updateSheet.noApk}</p> : null}
          {updateSheet.notesLabel ? (
            <div className="update-notes-block">
              <div className="update-notes-label">{updateSheet.notesLabel}</div>
              <p className="update-notes">{updateSheet.notes}</p>
            </div>
          ) : null}
        </div>
        <div className="update-sheet-foot">
          {updateSheet.auxiliary ? <p className="update-aux">{updateSheet.auxiliary}</p> : null}
          {updateSheet.openHint ? (
            <p className={`update-aux ${updateSheet.openHint.startsWith('未能') ? 'err' : ''}`}>
              {updateSheet.openHint}
            </p>
          ) : null}
          <button
            type="button"
            className="btn-update-primary"
            disabled={updateSheet.primary.disabled}
            onClick={() => onUpdateAction(updateSheet.primary.action)}
          >
            {updateSheet.primary.label}
          </button>
          {updateSheet.extra ? (
            <button
              type="button"
              className="btn-update-secondary"
              onClick={() => onUpdateAction(updateSheet.extra!.action)}
            >
              {updateSheet.extra.label}
            </button>
          ) : null}
          {updateSheet.secondary ? (
            <button
              type="button"
              className="btn-update-secondary"
              onClick={() => onUpdateAction(updateSheet.secondary!.action)}
            >
              {updateSheet.secondary.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  const dishOverlay = (
    <>
      <div className="scrim" onClick={closeSheet} />
      <div className="sheet2" role="dialog" aria-modal="true" aria-label={sheetTitle}>
        <div className="handle" />
        <div className="sheet2-head">
          <button type="button" className="back" onClick={onBack} aria-label="返回">
            ‹
          </button>
          <h3>{sheetTitle}</h3>
          <span className="cnt">{sheetCount}</span>
        </div>
        <div className="sheet2-list">
          {showingTags ? (
            visibleTags.length === 0 ? (
              <div className="empty-hint">还没有墨水签。</div>
            ) : (
              visibleTags.map(([label, count]) => (
                <button
                  type="button"
                  className="row"
                  key={label}
                  onClick={() => setTagFilter(label)}
                >
                  <div className="ico tags">🏷</div>
                  <div className="txt">
                    <h4>
                      {label}
                      <span className="pill">{count}</span>
                    </h4>
                    <p>点标签筛出贴过它的菜</p>
                  </div>
                  <div className="chev">›</div>
                </button>
              ))
            )
          ) : sheetDishes.length === 0 ? (
            <div className="empty-hint">这一页还是空的。</div>
          ) : (
            sheetDishes.map((r) => (
              <DishRow key={r.id} recipe={r} onOpen={(id) => navigate(`/recipe/${id}`)} />
            ))
          )}
        </div>
      </div>
    </>
  )

  const overlay = sheet === 'update' ? updateOverlay : sheet ? dishOverlay : null

  return (
    <div className="me-page">
      <div className="hero">
        <img className="bg" src={hero} alt="" />
        <div className="stamp">
          <span>{stamp.month}</span>
          <span>{stamp.day}</span>
          <span>{stamp.year}</span>
        </div>
      </div>

      <div className="profile">
        <div className="avatar" aria-hidden="true">
          🍳
        </div>
        <div className="who">
          <h1>厨房手帐</h1>
          <p>
            已记下 {published.length} 道 · 这周做了 {weekCount} 次
          </p>
        </div>
      </div>

      <div className="sheet lined-sheet">
        <div className="tape l" />
        <div className="tape r" />

        <div className="sec-title">厨房背景</div>
        <div className="bg-circles" aria-label="切换背景">
          <button
            type="button"
            className={`bg-circ ${bg === 'default' ? 'on' : ''}`}
            aria-label="默认厨房"
            aria-pressed={bg === 'default'}
            onClick={() => setBg('default')}
          >
            <img src={BG_DEFAULT} alt="" />
          </button>
          <button
            type="button"
            className={`bg-circ ${bg === 'male' ? 'on' : ''}`}
            aria-label="男生厨房"
            aria-pressed={bg === 'male'}
            onClick={() => setBg('male')}
          >
            <img src={BG_MALE} alt="" />
          </button>
          {customBgs.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`bg-circ ${bg === c.id ? 'on' : ''}`}
              aria-label="自定义背景"
              aria-pressed={bg === c.id}
              onClick={() => setBg(c.id)}
            >
              <img src={c.src} alt="" />
            </button>
          ))}
          <button
            type="button"
            className="bg-add-circ"
            aria-label="添加背景"
            onClick={() => fileRef.current?.click()}
          >
            +
          </button>
        </div>
        <p className="hint">点小圆切换首页背景 · 点 + 可继续加新图</p>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPickBg(e)} />

        <div className="sec-title">本周手帐</div>
        <div className="stats">
          <div className="stat all">
            <b>{published.length}</b>
            <span>全部菜谱</span>
          </div>
          <button
            type="button"
            className="stat sig"
            onClick={() => openSheet('signature')}
          >
            <b>{signature.length}</b>
            <span>拿手菜</span>
          </button>
          <button
            type="button"
            className="stat loved"
            onClick={() => openSheet('loved')}
          >
            <b>{loved.length}</b>
            <span>已收藏</span>
          </button>
        </div>

        <div className="sec-title">整理与筛选</div>
        <div className="search">
          <span className="ico" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.2 16.2L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索菜名 / 标签 / 踩坑…"
            enterKeyHint="search"
          />
        </div>
        <div className="menu">
          <button
            type="button"
            className={`row ${sheet === 'signature' ? 'active-row' : ''}`}
            onClick={() => openSheet('signature')}
          >
            <div className="ico sig">★</div>
            <div className="txt">
              <h4>
                拿手菜
                <span className="pill">{signature.length}</span>
              </h4>
              <p>你标过或常做的</p>
            </div>
            <div className="chev">›</div>
          </button>
          <button
            type="button"
            className={`row ${sheet === 'retry' ? 'active-row' : ''}`}
            onClick={() => openSheet('retry')}
          >
            <div className="ico retry">↻</div>
            <div className="txt">
              <h4>
                待复刻
                <span className="pill">{retry.length}</span>
              </h4>
              <p>想再做一遍的</p>
            </div>
            <div className="chev">›</div>
          </button>
          <button
            type="button"
            className={`row ${sheet === 'loved' ? 'active-row' : ''}`}
            onClick={() => openSheet('loved')}
          >
            <div className="ico loved">
              ♥
              <span className="stamp-heart">♥</span>
            </div>
            <div className="txt">
              <h4>
                已收藏
                <span className="pill loved-pill">{loved.length}</span>
              </h4>
              <p>你标了喜欢的</p>
            </div>
            <div className="chev">›</div>
          </button>
          <button
            type="button"
            className={`row ${sheet === 'tags' ? 'active-row' : ''}`}
            onClick={() => openSheet('tags')}
          >
            <div className="ico tags">🏷</div>
            <div className="txt">
              <h4>全部标签</h4>
              <p>成功 / 快手 / 踩坑… 管理墨水签</p>
            </div>
            <div className="chev">›</div>
          </button>
        </div>

        <div className="sec-title data-sec">数据与版本</div>
        {saveError ? (
          <p className="save-error" role="alert">
            {saveError}
          </p>
        ) : null}
        {hydrateWarning ? <p className="data-note">{hydrateWarning}</p> : null}
        {persistBlocked ? (
          <p className="save-error" role="alert">
            当前存储无法安全读取，已停止自动保存以免覆盖。请导入备份。
          </p>
        ) : null}
        <div className="menu data-menu">
          <button type="button" className="row" onClick={() => void onExport()} disabled={ioBusy}>
            <div className="ico e">⇩</div>
            <div className="txt">
              <h4>导出备份</h4>
              <p>菜谱、背景和照片打成一份 JSON</p>
            </div>
            <div className="chev">›</div>
          </button>
          <button
            type="button"
            className="row"
            onClick={() => backupRef.current?.click()}
            disabled={ioBusy}
          >
            <div className="ico f">⇧</div>
            <div className="txt">
              <h4>导入备份</h4>
              <p>会先请你确认，并留下恢复副本</p>
            </div>
            <div className="chev">›</div>
          </button>
          <button
            type="button"
            className="row"
            onClick={() => openSheet('update')}
          >
            <div className="ico c">↻</div>
            <div className="txt">
              <h4>
                {entry.title}
                {entry.badge ? <span className="new-flag">{entry.badge}</span> : null}
              </h4>
              {entry.subtitle ? <p>{entry.subtitle}</p> : null}
            </div>
            <div className="chev">›</div>
          </button>
        </div>
        {ioMessage ? <p className="data-note">{ioMessage}</p> : null}
        <input
          ref={backupRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onImportFile(e)}
        />
      </div>

      {overlay ? (host ? createPortal(overlay, host) : overlay) : null}
    </div>
  )
}
