import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useJournal } from '../context/JournalContext'
import { formatFieldDate, toISODate, uid } from '../lib/dates'
import { inferTagKind, readImageAsDataUrl } from '../lib/images'
import { BG_WINDOW, PRESET_TAGS, type InkTag, type Recipe } from '../types'

function blankRecipe(): Recipe {
  const now = new Date().toISOString()
  return {
    id: uid('r'),
    name: '',
    photos: [],
    duration: '',
    cookedAt: toISODate(),
    timesCooked: 1,
    method: '',
    pits: [''],
    tags: [],
    isDraft: true,
    isSignature: false,
    toRetry: false,
    shared: false,
    loved: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function Edit() {
  const { id } = useParams()
  return <EditForm key={id ?? 'new'} id={id} />
}

function EditForm({ id }: { id: string | undefined }) {
  const isNew = !id
  const { get, upsert, remove } = useJournal()
  const navigate = useNavigate()
  const existing = id ? get(id) : undefined
  const fileRef = useRef<HTMLInputElement>(null)

  const initial = useMemo(() => existing ?? blankRecipe(), [existing])

  const [name, setName] = useState(initial.name)
  const [photos, setPhotos] = useState<string[]>(initial.photos)
  const [duration, setDuration] = useState(initial.duration)
  const [cookedAt, setCookedAt] = useState(initial.cookedAt)
  const [method, setMethod] = useState(initial.method)
  const [pits, setPits] = useState<string[]>(initial.pits.length ? initial.pits : [''])
  const [tags, setTags] = useState<InkTag[]>(initial.tags)
  const [nameError, setNameError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState('')

  if (id && !existing) {
    return (
      <div className="missing">
        <p>这页手帐找不到了。</p>
        <button type="button" className="edit-link" onClick={() => navigate('/')}>
          回首页
        </button>
      </div>
    )
  }

  const selected = new Set(tags.map((t) => t.label))

  function build(isDraft: boolean): Recipe {
    const cleanedPits = pits.map((p) => p.trim()).filter(Boolean)
    const nextName = name.trim() || (isDraft ? '未命名草稿' : name.trim())
    return {
      ...initial,
      name: nextName,
      photos,
      duration: duration.trim() || '约 — 分钟',
      cookedAt,
      method: method.trim(),
      pits: cleanedPits,
      tags,
      isDraft,
      isSignature: initial.isSignature || tags.some((t) => t.label === '拿手'),
      toRetry: initial.toRetry || tags.some((t) => t.label === '待复刻'),
      updatedAt: new Date().toISOString(),
    }
  }

  function save(isDraft: boolean) {
    if (!isDraft && !name.trim()) {
      setNameError(true)
      return
    }
    upsert(build(isDraft))
    navigate('/')
  }

  function onDelete() {
    if (!confirm('要撕掉这页手帐吗？删了就找不回来了。')) return
    remove(initial.id)
    navigate('/')
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const extras: string[] = []
    for (const f of files.slice(0, 9 - photos.length)) {
      try {
        extras.push(await readImageAsDataUrl(f))
      } catch {
        /* skip unreadable files */
      }
    }
    if (extras.length) setPhotos((prev) => [...prev, ...extras].slice(0, 9))
  }

  function togglePreset(tag: InkTag) {
    setTags((prev) =>
      prev.some((t) => t.label === tag.label)
        ? prev.filter((t) => t.label !== tag.label)
        : [...prev, tag],
    )
  }

  function addCustom() {
    const label = customLabel.trim()
    if (!label) {
      setAddingCustom(false)
      return
    }
    if (!tags.some((t) => t.label === label)) {
      setTags((prev) => [...prev, { label, kind: inferTagKind(label) }])
    }
    setCustomLabel('')
    setAddingCustom(false)
  }

  const customTags = tags.filter((t) => !PRESET_TAGS.some((p) => p.label === t.label))

  return (
    <>
      <div className="hero">
        <img src={BG_WINDOW} alt="" />
        <div className="hero-fade" />
        <div className="nav">
          <button type="button" className="chip" onClick={() => navigate(-1)} aria-label="返回">
            ‹
          </button>
          <div className="nav-title">{isNew ? '记下这道菜' : '编辑手帐'}</div>
          <button
            type="button"
            className="chip"
            aria-label="更多"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div className="menu-pop">
          {!isNew ? (
            <button type="button" className="danger" onClick={onDelete}>
              删除这一页
            </button>
          ) : (
            <button type="button" onClick={() => navigate('/')}>
              先不记了
            </button>
          )}
        </div>
      ) : null}

      <div className="edit-sheet lined-sheet">
        {isNew ? (
          <>
            <div className="tape" style={{ width: 72, left: 20, top: -8, transform: 'rotate(-7deg)' }} />
            <div className="tape green" style={{ width: 58, right: 24, top: -6, transform: 'rotate(10deg)' }} />
          </>
        ) : (
          <div
            className="tape green"
            style={{ width: 68, left: '50%', marginLeft: -34, top: -8, transform: 'rotate(-2deg)' }}
          />
        )}

        <div className="label">
          菜名 <span className="req">必填</span>
        </div>
        <div className={`field title ${nameError && !name.trim() ? 'error' : ''}`}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (e.target.value.trim()) setNameError(false)
            }}
            placeholder="比如：红烧肉"
            maxLength={24}
          />
        </div>

        <div className="label">实拍贴贴</div>
        <div className="photos">
          <button type="button" className="add-photo" onClick={() => fileRef.current?.click()}>
            <div className="plus">+</div>
            加照片
          </button>
          {photos.map((src, i) => (
            <div className="shot" key={i}>
              <img src={src} alt="" />
              <button
                type="button"
                className="x"
                aria-label="去掉照片"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onFiles}
        />
        {isNew ? <div className="hint">做饭后随手拍，可多张</div> : null}

        <div className="label">用时 · 日期</div>
        <div className="row2">
          <div className="field">
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="约 — 分钟"
            />
          </div>
          <div className="field date-field">
            <span>{formatFieldDate(cookedAt)}</span>
            <input
              type="date"
              value={cookedAt}
              onChange={(e) => setCookedAt(e.target.value || cookedAt)}
            />
          </div>
        </div>

        <div className="label">做法</div>
        <div className="area">
          <textarea
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="怎么做都行，写一段话、列几点、贴心得都可以…"
          />
        </div>

        <div className="label">踩过的坑</div>
        <div className="pits">
          {pits.map((p, i) => (
            <div className="pit-row" key={i}>
              <div className="pit-num">{i + 1}</div>
              <div className="pit-body">
                <textarea
                  value={p}
                  placeholder="这回踩了什么坑？下次别忘…"
                  onChange={(e) =>
                    setPits((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
              </div>
              <button
                type="button"
                className="pit-x"
                aria-label="删掉这条"
                onClick={() => setPits((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="pit-add" onClick={() => setPits((prev) => [...prev, ''])}>
            + 再记一条
          </button>
        </div>

        <div className="label">标签</div>
        <div className="tags">
          {PRESET_TAGS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`ink ${selected.has(p.label) ? p.kind : 'add'}`}
              onClick={() => togglePreset(p)}
            >
              {selected.has(p.label) ? p.label : `+ ${p.label}`}
            </button>
          ))}
          {customTags.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`ink ${t.kind}`}
              onClick={() => setTags((prev) => prev.filter((x) => x.label !== t.label))}
            >
              {t.label}
            </button>
          ))}
          {addingCustom ? (
            <input
              className="custom-tag-input"
              autoFocus
              value={customLabel}
              placeholder="标签"
              onChange={(e) => setCustomLabel(e.target.value)}
              onBlur={addCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
                if (e.key === 'Escape') {
                  setAddingCustom(false)
                  setCustomLabel('')
                }
              }}
            />
          ) : (
            <button type="button" className="ink add" onClick={() => setAddingCustom(true)}>
              {customTags.length || tags.length ? '+' : '+ 自定义'}
            </button>
          )}
        </div>
      </div>

      <div className="edit-bottom">
        {isNew ? (
          <>
            <button type="button" className="btn-ghost" onClick={() => save(true)}>
              存草稿
            </button>
            <button type="button" className="btn-ink" onClick={() => save(false)}>
              记好了
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost danger" onClick={onDelete}>
              删除
            </button>
            <button type="button" className="btn-ink" onClick={() => save(false)}>
              保存修改
            </button>
          </>
        )}
      </div>
    </>
  )
}
