import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJournal } from '../context/JournalContext'

export function Categories() {
  const { recipes } = useJournal()
  const navigate = useNavigate()
  const published = recipes.filter((r) => !r.isDraft)

  const groups = useMemo(() => {
    const map = new Map<string, typeof published>()
    for (const r of published) {
      const labels = r.tags.length ? r.tags.map((t) => t.label) : ['未贴标签']
      for (const label of labels) {
        const arr = map.get(label) ?? []
        arr.push(r)
        map.set(label, arr)
      }
    }
    return [...map.entries()]
  }, [published])

  return (
    <div className="page-pad">
      <div className="tape green" style={{ width: 64, right: 28, top: 10, transform: 'rotate(8deg)' }} />
      <p className="page-kicker">TAGS</p>
      <h1 className="page-title">分类</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        这一页还没出视觉稿，先按标签把菜归在一起。
      </p>
      {groups.length === 0 ? (
        <div className="empty-hint">手帐还是空的。</div>
      ) : (
        groups.map(([label, items]) => (
          <div className="group-block" key={label}>
            <div className="sec">{label}</div>
            {items.map((r) => (
              <button
                type="button"
                className="entry"
                key={`${label}-${r.id}`}
                onClick={() => navigate(`/recipe/${r.id}`)}
              >
                <div className={`mini ${r.photos[0] ? '' : 'ph'}`}>
                  {r.photos[0] ? <img src={r.photos[0]} alt="" /> : '🍽'}
                </div>
                <div className="entry-body">
                  <h4>{r.name}</h4>
                  <div className="sub">{r.duration}</div>
                </div>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
