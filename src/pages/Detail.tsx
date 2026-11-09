import { useNavigate, useParams } from 'react-router-dom'
import { useJournal } from '../context/JournalContext'
import { CIRCLED } from '../lib/images'
import { formatRelative } from '../lib/dates'
import { BG_WINDOW } from '../types'

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

export function Detail() {
  const { id } = useParams()
  const { get, upsert } = useJournal()
  const navigate = useNavigate()
  const recipe = id ? get(id) : undefined

  if (!recipe) {
    return (
      <div className="missing">
        <p>这页手帐找不到了。</p>
        <button type="button" className="edit-link" onClick={() => navigate('/')}>
          回首页
        </button>
      </div>
    )
  }

  const lines = recipe.method
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const pits = recipe.pits.map((p) => p.trim()).filter(Boolean)

  return (
    <>
      <div className="d-scene">
        <img src={BG_WINDOW} alt="" />
        <button type="button" className="nav-chip back" onClick={() => navigate(-1)} aria-label="返回">
          ‹
        </button>
        <button
          type="button"
          className="nav-chip share"
          onClick={() => navigate(`/share/${recipe.id}`)}
          aria-label="分享"
        >
          ↗
        </button>
        <div className="d-fade" />
      </div>

      <div className="torn">
        <div
          className="tape green"
          style={{ width: 70, left: '50%', marginLeft: -35, top: -8, transform: 'rotate(-2deg)' }}
        />
        <div className="detail-title">{recipe.name}</div>
        <div className="meta-line">
          <span>
            {formatRelative(recipe.cookedAt)} · {recipe.duration} · 做过 {recipe.timesCooked} 次
          </span>
          <button type="button" className="edit-link" onClick={() => navigate(`/edit/${recipe.id}`)}>
            改一改
          </button>
        </div>
        <div className="detail-tags">
          {recipe.tags.map((t) => (
            <span key={t.label} className={`ink ${t.kind} lg`}>
              {t.label}
            </span>
          ))}
          <button
            type="button"
            className={`loved-chip${recipe.loved ? ' on' : ''}`}
            aria-pressed={recipe.loved}
            aria-label={recipe.loved ? '取消收藏' : '收藏'}
            onClick={() => upsert({ ...recipe, loved: !recipe.loved })}
          >
            {recipe.loved ? '♥ 已收藏' : '♡ 收藏'}
          </button>
        </div>

        <div className="hand-h">做法</div>
        {lines.length > 1 ? (
          lines.map((line, i) => (
            <div className="step" key={i}>
              <div className="n">{CIRCLED[i] ?? `${i + 1}.`}</div>
              <p>{line}</p>
            </div>
          ))
        ) : (
          <p className="method-block">{recipe.method || '还没写下做法。'}</p>
        )}

        <div className="hand-h">踩过的坑</div>
        {pits.length === 0 ? (
          <p className="method-block" style={{ color: '#9A7B63' }}>
            这回没踩坑，运气不错。
          </p>
        ) : (
          pits.map((p, i) => {
            const { title, body } = splitPit(p)
            return (
              <div className={`sticky-note ${i % 2 ? 'alt' : ''}`} key={i}>
                <div className="lab">{title}</div>
                {body ? <p>{body}</p> : null}
              </div>
            )
          })
        )}

        {recipe.photos.length > 0 ? (
          <>
            <div className="hand-h">实拍贴贴</div>
            <div className="photo-row">
              {recipe.photos.slice(0, 3).map((src, i) => (
                <div className="shot" key={i}>
                  <img src={src} alt="" />
                  <div className="cap">· 实拍 ·</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="share-row">
        <button
          type="button"
          className="btn-ink"
          onClick={() => {
            if (!recipe.shared) upsert({ ...recipe, shared: true, updatedAt: new Date().toISOString() })
            navigate(`/share/${recipe.id}`)
          }}
        >
          分享这道菜
        </button>
      </div>
    </>
  )
}
