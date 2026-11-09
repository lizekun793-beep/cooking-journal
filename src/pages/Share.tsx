import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Share as CapShare } from '@capacitor/share'
import { useJournal } from '../context/JournalContext'
import { dateStamp, formatRelative } from '../lib/dates'
import { isNativeApp } from '../lib/platform'
import { exportShareCardPng, safePngFilename, savePngBlob } from '../lib/shareCardImage'
import { BG_WINDOW } from '../types'
import type { Recipe } from '../types'

function shareUrl(id: string): string {
  return `${window.location.origin}/share/${id}`
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

async function copyText(text: string): Promise<boolean> {
  try {
    await withTimeout(navigator.clipboard.writeText(text), 800)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}

function splitPit(text: string): { title: string; body: string } {
  const idx = text.indexOf('——')
  if (idx > 0) {
    return { title: text.slice(0, idx).trim(), body: text.slice(idx + 2).trim() }
  }
  const comma = text.indexOf('，')
  if (comma > 0 && comma < 16) {
    return { title: text.slice(0, comma).trim(), body: text.slice(comma + 1).trim() }
  }
  return { title: text, body: '' }
}

function excerptOf(method: string): string {
  const text = method.replace(/\s+/g, ' ').trim()
  return text || '一页厨房手帐。'
}

export function Share() {
  const { id } = useParams()
  const { recipes, get, upsert } = useJournal()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const stamp = dateStamp()

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }

  function markShared(recipe: Recipe) {
    if (!recipe.shared) upsert({ ...recipe, shared: true, updatedAt: new Date().toISOString() })
  }

  async function doWechat(recipe: Recipe) {
    markShared(recipe)
    const url = shareUrl(recipe.id)
    const payload = {
      title: `做菜手帐 · ${recipe.name}`,
      text: `我做了「${recipe.name}」，来翻一页厨房手帐`,
      url,
    }
    try {
      if (isNativeApp()) {
        await CapShare.share({ ...payload, dialogTitle: '分享这道菜' })
        flash('已唤起系统分享')
        return
      }
      if (typeof navigator.share === 'function') {
        await navigator.share(payload)
        flash('已唤起系统分享')
        return
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
    }
    const ok = await copyText(url)
    flash(ok ? '链接已复制' : '复制失败，请手动复制')
  }

  async function doCopy(recipe: Recipe) {
    markShared(recipe)
    const ok = await copyText(shareUrl(recipe.id))
    flash(ok ? '链接已复制' : '复制失败，请手动复制')
  }

  async function doSave(recipe: Recipe) {
    if (saving) return
    setSaving(true)
    markShared(recipe)
    const firstPit = recipe.pits.map((p) => p.trim()).filter(Boolean)[0]
    const pit = firstPit ? splitPit(firstPit) : undefined
    try {
      const blob = await exportShareCardPng(cardRef.current, {
        name: recipe.name,
        coverSrc: recipe.photos[0] ?? BG_WINDOW,
        meta: `${formatRelative(recipe.cookedAt)} · ${recipe.duration} · 做过 ${recipe.timesCooked} 次`,
        tags: recipe.tags.map((t) => t.label),
        excerpt: excerptOf(recipe.method),
        pit: pit ? { title: pit.title, body: pit.body } : undefined,
        stamp,
      })
      const how = await savePngBlob(blob, safePngFilename(recipe.name))
      flash(how === 'shared' ? '已打开保存/分享' : '图片已保存')
    } catch {
      flash('暂无法保存，请截图')
    } finally {
      setSaving(false)
    }
  }

  if (id) {
    const recipe = get(id)
    if (!recipe) {
      return (
        <div className="missing">
          <p>这页手帐找不到了。</p>
          <button type="button" className="edit-link" onClick={() => navigate('/share')}>
            回分享
          </button>
        </div>
      )
    }

    const cover = recipe.photos[0] ?? BG_WINDOW
    const excerpt = excerptOf(recipe.method)
    const firstPit = recipe.pits.map((p) => p.trim()).filter(Boolean)[0]
    const pit = firstPit ? splitPit(firstPit) : undefined

    return (
      <div className="share-dish">
        <div className="share-topbar">
          <button type="button" className="chip" onClick={() => navigate(-1)} aria-label="返回">
            ‹
          </button>
          <h1>分享这道菜</h1>
          <span className="chip" style={{ visibility: 'hidden' }} aria-hidden>
            ‹
          </span>
        </div>

        <div className="share-stage">
          <div className="share-card" ref={cardRef}>
            <div className="washi" />
            <div className="polaroid">
              <img src={cover} alt={recipe.name} />
            </div>
            <div className="dish-name">{recipe.name}</div>
            <div className="meta">
              {formatRelative(recipe.cookedAt)} · {recipe.duration} · 做过 {recipe.timesCooked} 次
            </div>
            {recipe.tags.length ? (
              <div className="share-tags">
                {recipe.tags.map((t) => (
                  <span key={t.label} className={`ink ${t.kind}`}>
                    {t.label}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="excerpt">{excerpt}</p>
            {pit ? (
              <div className="pit-sticky">
                <div className="lab">踩过的坑 · {pit.title}</div>
                {pit.body ? <p>{pit.body}</p> : null}
              </div>
            ) : null}
            <div className="brand-strip">
              <span className="brand">厨房手帐</span>
              <div className="share-stamp">
                {stamp.month}
                <br />
                {stamp.day}
                <br />
                {stamp.year}
              </div>
            </div>
          </div>
        </div>

        <div className="share-act">
          <button
            type="button"
            className="share-save"
            disabled={saving}
            onClick={() => void doSave(recipe)}
          >
            {saving ? '保存中…' : '保存图片'}
          </button>
          <div className="share-act-row">
            <button type="button" className="share-ghost" onClick={() => void doWechat(recipe)}>
              微信分享
            </button>
            <button type="button" className="share-ghost" onClick={() => void doCopy(recipe)}>
              复制链接
            </button>
          </div>
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    )
  }

  const list = recipes.filter((r) => !r.isDraft)

  return (
    <div className="page-pad">
      <div className="tape" style={{ width: 70, left: 24, top: 12, transform: 'rotate(-6deg)' }} />
      <p className="page-kicker">SHARE</p>
      <h1 className="page-title">把手帐分享出去</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        点进去生成手帐卡片，保存图片或发给朋友。
      </p>
      {list.length === 0 ? (
        <div className="empty-hint">还没有可分享的菜。</div>
      ) : (
        list.map((r) => (
          <button
            type="button"
            key={r.id}
            className="entry"
            onClick={() => navigate(`/share/${r.id}`)}
          >
            <div className={`mini ${r.photos[0] ? '' : 'ph'}`}>
              {r.photos[0] ? <img src={r.photos[0]} alt="" /> : '🍽'}
            </div>
            <div className="entry-body">
              <h4>{r.name}</h4>
              <div className="sub">{r.shared ? '分享过' : '还没分享'}</div>
            </div>
            <div className="marks">
              {r.shared ? <span className="ink ok">已分享</span> : <span className="ink add">去分享</span>}
            </div>
          </button>
        ))
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
