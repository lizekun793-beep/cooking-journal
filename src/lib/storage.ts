import { seedRecipes } from '../data/seed'
import { publicUrl, type BgChoice, type CustomBg, type Recipe } from '../types'
import { BG_KEY, CUSTOM_BG_KEY, RECIPES_KEY } from './journal/keys'

function normalizeAssetUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:') || /^https?:/i.test(url)) {
    return url
  }
  if (url.startsWith('/backgrounds/') || url.startsWith('/food/')) {
    return publicUrl(url.slice(1))
  }
  return url
}

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    photos: (recipe.photos || []).map(normalizeAssetUrl),
  }
}

/** Browser-only sync helpers. Native persistence goes through JournalStore. */
export function loadRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(RECIPES_KEY)
    if (!raw) {
      const seed = seedRecipes().map(normalizeRecipe)
      localStorage.setItem(RECIPES_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw) as Recipe[]
    if (!Array.isArray(parsed)) return seedRecipes().map(normalizeRecipe)
    const normalized = parsed.map(normalizeRecipe)
    localStorage.setItem(RECIPES_KEY, JSON.stringify(normalized))
    return normalized
  } catch {
    return seedRecipes().map(normalizeRecipe)
  }
}

export function saveRecipes(recipes: Recipe[]): void {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes))
}

export function loadBg(): BgChoice {
  const v = localStorage.getItem(BG_KEY)
  if (!v) return 'default'
  return v
}

export function saveBg(bg: BgChoice): void {
  localStorage.setItem(BG_KEY, bg)
}

export function loadCustomBgs(): CustomBg[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomBg[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is CustomBg =>
        !!item && typeof item.id === 'string' && typeof item.src === 'string' && item.src.length > 0,
    )
  } catch {
    return []
  }
}

export function saveCustomBgs(list: CustomBg[]): void {
  try {
    localStorage.setItem(CUSTOM_BG_KEY, JSON.stringify(list))
  } catch {
    /* quota / private mode — keep in-memory only */
  }
}

export { BG_KEY, CUSTOM_BG_KEY, RECIPES_KEY }
