export type InkKind = 'ok' | 'pit' | 'plain'

/** Built-in ids are `default` / `male`; custom backgrounds use ids like `bg_xxx`. */
export type BgChoice = string

export interface CustomBg {
  id: string
  src: string
}

export interface InkTag {
  label: string
  kind: InkKind
}

export interface Recipe {
  id: string
  name: string
  photos: string[]
  duration: string
  cookedAt: string
  timesCooked: number
  method: string
  pits: string[]
  tags: InkTag[]
  isDraft: boolean
  isSignature: boolean
  toRetry: boolean
  shared: boolean
  loved: boolean
  createdAt: string
  updatedAt: string
}

export type FilterKey = 'recent' | 'signature' | 'retry' | 'loved'

export const PRESET_TAGS: InkTag[] = [
  { label: '成功', kind: 'ok' },
  { label: '快手', kind: 'plain' },
  { label: '家常', kind: 'plain' },
]

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'recent', label: '最近' },
  { key: 'signature', label: '拿手菜' },
  { key: 'retry', label: '待复刻' },
  { key: 'loved', label: '已收藏' },
]

export function matchesFilter(r: Recipe, filter: FilterKey): boolean {
  if (r.isDraft) return false
  if (filter === 'recent') return true
  if (filter === 'signature') return r.isSignature || r.tags.some((t) => t.label === '拿手')
  if (filter === 'retry') return r.toRetry || r.tags.some((t) => t.label === '待复刻')
  return r.loved
}

/** Public asset URL that respects Vite `base` (e.g. GitHub Pages subpath). */
export function publicUrl(path: string): string {
  const clean = path.replace(/^\/+/, '')
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${clean}`
}

export const BG_DEFAULT = publicUrl('backgrounds/bg-kitchen-default.jpg')
export const BG_MALE = publicUrl('backgrounds/bg-kitchen-male-cook.jpg')
export const BG_WINDOW = publicUrl('backgrounds/bg-kitchen-window.jpg')

export function resolveBgSrc(bg: BgChoice, customBgs: CustomBg[] = []): string {
  if (bg === 'male') return BG_MALE
  if (!bg || bg === 'default') return BG_DEFAULT
  return customBgs.find((c) => c.id === bg)?.src ?? BG_DEFAULT
}
