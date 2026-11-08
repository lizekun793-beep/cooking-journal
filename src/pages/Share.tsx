import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useJournal } from '../context/JournalContext'
import { formatRelative } from '../lib/dates'
import { BG_WINDOW } from '../types'
import type { Recipe } from '../types'

function shareUrl(id: string): string {
  return `${window.location.origin}/share/${id}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
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

function Card({ recipe }: { recipe: Recipe }) {
  const cover = recipe.photos[0] ?? BG_WINDOW
  const quote = recipe.method.split('\n').map((s) => s.trim()).filter(Boolean)[0] ?? '一页厨房手帐。'
  return (
    <div className="share-card lined-sheet">
      <div
        className="tape green"
        style={{ width: 64, left: '50%', marginLeft: -32, top: -8, transform: 'rotate(-2deg)' }}
      />
      <div className="share-hero">
        <img src={cover} alt={recipe.name} />
      </div>
      <div className="detail-title">{recipe.name}</div>
      <div className="meta-line" style={{ display: 'block' }}>
        {formatRelative(recipe.cookedAt)} · {recipe.duration}
      </div>
      <div className="detail-tags">
        {recipe.tags.map((t) => (
          <span key={t.label} className={`ink ${t.kind} lg`}>
            {t.label}
          </span>
        ))}
      </div>
      <p className="share-quote">{quote}</p>
    </div>
  )
}

export function Share() {
  const { id } = useParams()
  const { recipes, get, upsert } = useJournal()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }

  async function doShare(recipe: Recipe) {
    if (!recipe.shared) upsert({ ...recipe, shared: true, updatedAt: new Date().toISOString() })
    const url = shareUrl(recipe.id)
    const payload = {
      title: `做菜手帐 · ${recipe.name}`,
      text: `我做了「${recipe.name}」，来翻一页厨房手帐`,
      url,
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(payload)
        flash('已唤起系统分享')
        return
      } catch {
        /* user cancelled or unsupported */
      }
    }
    const ok = await copyText(url)
    flash(ok ? '链接已复制' : '复制失败，请手动复制')
  }

  async function doCopy(recipe: Recipe) {
    if (!recipe.shared) upsert({ ...recipe, shared: true, updatedAt: new Date().toISOString() })
    const ok = await copyText(shareUrl(recipe.id))
    flash(ok ? '链接已复制' : '复制失败，请手动复制')
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
    return (
      <>
        <div className="hero" style={{ height: 120 }}>
          <img src={BG_WINDOW} alt="" />
          <div className="hero-fade" />
          <div className="nav">
            <button type="button" className="chip" onClick={() => navigate(-1)} aria-label="返回">
              ‹
            </button>
            <div className="nav-title">分享这道菜</div>
            <div className="chip" style={{ visibility: 'hidden' }}>
              ⋯
            </div>
          </div>
        </div>
        <div className="page-pad" style={{ paddingTop: 8 }}>
          <p className="page-kicker">视觉还在画 · 先用这张卡片</p>
          <Card recipe={recipe} />
          <div className="share-actions">
            <button type="button" className="btn-ghost" onClick={() => void doCopy(recipe)}>
              复制链接
            </button>
            <button type="button" className="btn-ink" onClick={() => void doShare(recipe)}>
              分享出去
            </button>
          </div>
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    )
  }

  const list = recipes.filter((r) => !r.isDraft)

  return (
    <div className="page-pad">
      <div className="tape" style={{ width: 70, left: 24, top: 12, transform: 'rotate(-6deg)' }} />
      <p className="page-kicker">SHARE</p>
      <h1 className="page-title">把手帐分享出去</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        分享页视觉还没定稿，先用卡片预览 · 复制链接，或走系统分享。
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
