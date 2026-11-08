import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJournal } from '../context/JournalContext'
import { dateStamp, formatEntryMeta } from '../lib/dates'
import { InkTag } from '../components/InkTag'
import {
  FILTERS,
  resolveBgSrc,
  type FilterKey,
  type Recipe,
} from '../types'

function matchesFilter(r: Recipe, filter: FilterKey): boolean {
  if (r.isDraft) return false
  if (filter === 'recent') return true
  if (filter === 'signature') return r.isSignature || r.tags.some((t) => t.label === '拿手')
  if (filter === 'retry') return r.toRetry || r.tags.some((t) => t.label === '待复刻')
  return r.shared
}

export function Home() {
  const { recipes, bg, customBgs } = useJournal()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('recent')
  const stamp = dateStamp()

  const published = useMemo(
    () => recipes.filter((r) => !r.isDraft),
    [recipes],
  )

  const latest = useMemo(() => {
    return [...published].sort((a, b) => (a.cookedAt < b.cookedAt ? 1 : -1))[0]
  }, [published])

  const list = useMemo(() => {
    return published
      .filter((r) => matchesFilter(r, filter))
      .sort((a, b) => (a.cookedAt < b.cookedAt ? 1 : -1))
  }, [published, filter])

  const hero = resolveBgSrc(bg, customBgs)

  return (
    <>
      <div className={`scene ${bg === 'male' ? 'male' : ''}`}>
        <img className="scene-bg" src={hero} alt="厨房插画" />
        <div className="date-stamp">
          <span>{stamp.month}</span>
          <b>{stamp.day}</b>
          <span>{stamp.year}</span>
        </div>
        <div className="scene-fade" />
        <div className="scene-title">
          <h1>今天想吃什么</h1>
          <p>
            {published.length === 0
              ? '手帐还是空白的，先记一道菜吧'
              : `已记下 ${published.length} 道 · 最近：${latest?.name ?? '—'}`}
          </p>
        </div>
      </div>

      <div className="sheet lined-sheet">
        <div className="tape" style={{ width: 78, left: 22, top: -8, transform: 'rotate(-7deg)' }} />
        <div className="tape green" style={{ width: 64, right: 26, top: -6, transform: 'rotate(11deg)' }} />
        <div className="ask">翻开手帐 · 找一道菜</div>
        <div className="sticky-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`sticky ${filter === f.key ? 'on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sec">目录</div>
        {list.length === 0 ? (
          <div className="empty-hint">
            {published.length === 0 ? '还没有菜。点中间的「记下」，写第一页。' : '这一页还是空的。'}
          </div>
        ) : (
          <div className="catalog">
            {list.map((r) => (
              <button
                type="button"
                className="entry"
                key={r.id}
                onClick={() => navigate(`/recipe/${r.id}`)}
              >
                <div className={`mini ${r.photos[0] ? '' : 'ph'}`}>
                  {r.photos[0] ? <img src={r.photos[0]} alt={r.name} /> : '🍽'}
                </div>
                <div className="entry-body">
                  <h4>{r.name}</h4>
                  <div className="sub">
                    {formatEntryMeta(r.cookedAt, r.duration, r.tags.some((t) => t.label === '拿手'))}
                  </div>
                </div>
                <div className="marks">
                  {r.tags.slice(0, 2).map((t) => (
                    <InkTag key={t.label} label={t.label} kind={t.kind} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
