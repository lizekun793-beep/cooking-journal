import { describe, expect, it } from 'vitest'
import { FILTERS, matchesFilter, type Recipe } from './types'

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: '测试菜',
    photos: [],
    duration: '约 10 分钟',
    cookedAt: '2026-11-08',
    timesCooked: 1,
    method: '',
    pits: [],
    tags: [],
    isDraft: false,
    isSignature: false,
    toRetry: false,
    shared: false,
    loved: false,
    createdAt: '2026-11-08T00:00:00.000Z',
    updatedAt: '2026-11-08T00:00:00.000Z',
    ...over,
  }
}

describe('FILTERS', () => {
  it('labels the fourth chip 已收藏 (loved), not 分享过', () => {
    expect(FILTERS.map((f) => f.key)).toEqual(['recent', 'signature', 'retry', 'loved'])
    expect(FILTERS.map((f) => f.label)).toEqual(['最近', '拿手菜', '待复刻', '已收藏'])
  })
})

describe('matchesFilter', () => {
  it('filters loved by r.loved', () => {
    expect(matchesFilter(recipe({ loved: true }), 'loved')).toBe(true)
    expect(matchesFilter(recipe({ loved: false, shared: true }), 'loved')).toBe(false)
    expect(matchesFilter(recipe({ isDraft: true, loved: true }), 'loved')).toBe(false)
  })
})
