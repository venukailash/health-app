import type { Food, Nutrients, Serving } from '../domain/types'
import { ZERO_NUTRIENTS, round } from '../domain/nutrition'
import { LookupFailedError, RateLimitedError } from './openFoodFacts'

/**
 * USDA FoodData Central — free-text food search.
 *
 * Open Food Facts would be the natural choice (it is what the barcode lookup
 * uses), but every one of its search endpoints refuses cross-origin browser
 * requests: `cgi/search.pl` answers 503 the moment an `Origin` header is
 * present, and the newer search service sends no
 * `access-control-allow-origin` at all. Its barcode endpoint does send proper
 * CORS headers, so the two sources split by what actually works from a
 * browser: FDC for searching, Open Food Facts for scanning.
 *
 * Without a proxy — which would mean running infrastructure — this is the
 * arrangement that keeps the app a pure static site.
 */

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'

/**
 * USDA's shared demo key, good for about 10 requests an hour. Enough to try
 * the app; Settings takes a personal key (free, instant) for 1,000/hour.
 */
export const DEMO_API_KEY = 'DEMO_KEY'

/** Nutrient numbers are stable; the display names are not. */
const NUTRIENT = {
  energyKcal: '208',
  protein: '203',
  fat: '204',
  satFat: '606',
  carbs: '205',
  fibre: '291',
  sodiumMg: '307',
} as const

export interface SearchedFood {
  id: string
  name: string
  brand?: string
  per100g: Nutrients
  defaultServing?: Serving
  incomplete: boolean
}

interface RawNutrient {
  nutrientNumber?: string
  unitName?: string
  value?: number
}

const valueOf = (nutrients: RawNutrient[], number: string): number | undefined => {
  const match = nutrients.find((nutrient) => nutrient.nutrientNumber === number)
  const value = match?.value
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export function toNutrients(raw: RawNutrient[]): { per100g: Nutrients; incomplete: boolean } {
  const kcal = valueOf(raw, NUTRIENT.energyKcal)
  const fibre = valueOf(raw, NUTRIENT.fibre) ?? 0
  const totalCarbs = valueOf(raw, NUTRIENT.carbs) ?? 0
  const sodiumMg = valueOf(raw, NUTRIENT.sodiumMg)

  const per100g: Nutrients = {
    ...ZERO_NUTRIENTS,
    kcal: round(kcal ?? 0, 0),
    fat: round(valueOf(raw, NUTRIENT.fat) ?? 0, 1),
    satFat: round(valueOf(raw, NUTRIENT.satFat) ?? 0, 1),
    // USDA reports carbohydrate "by difference", which INCLUDES fibre. The
    // app follows the UK label convention where the two are separate, so
    // fibre comes out of the carbohydrate figure — otherwise it is counted
    // twice on the dashboard.
    carbs: round(Math.max(0, totalCarbs - fibre), 1),
    fibre: round(fibre, 1),
    protein: round(valueOf(raw, NUTRIENT.protein) ?? 0, 1),
    // Sodium is milligrams; salt is grams. salt = sodium x 2.5.
    salt: round(sodiumMg !== undefined ? (sodiumMg * 2.5) / 1000 : 0, 2),
  }

  if (per100g.satFat > per100g.fat) per100g.satFat = per100g.fat

  return { per100g, incomplete: kcal === undefined || kcal <= 0 }
}

/** Title-case the shouty descriptions USDA uses for branded items. */
export function tidyName(description: string): string {
  const trimmed = description.trim()
  if (trimmed !== trimmed.toUpperCase()) return trimmed
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
}

export function toSearchedFood(raw: Record<string, unknown>): SearchedFood | null {
  const description = typeof raw.description === 'string' ? raw.description.trim() : ''
  const id = raw.fdcId
  if (description === '' || (typeof id !== 'number' && typeof id !== 'string')) return null

  const nutrients = Array.isArray(raw.foodNutrients) ? (raw.foodNutrients as RawNutrient[]) : []
  const { per100g, incomplete } = toNutrients(nutrients)

  const brandField =
    (typeof raw.brandName === 'string' && raw.brandName) ||
    (typeof raw.brandOwner === 'string' && raw.brandOwner) ||
    ''

  const servingGrams =
    typeof raw.servingSize === 'number' &&
    typeof raw.servingSizeUnit === 'string' &&
    raw.servingSizeUnit.toLowerCase() === 'g' &&
    raw.servingSize > 0
      ? round(raw.servingSize, 1)
      : undefined

  return {
    id: String(id),
    name: tidyName(description),
    brand: brandField ? tidyName(brandField) : undefined,
    per100g,
    defaultServing: servingGrams ? { label: `${servingGrams} g serving`, grams: servingGrams } : undefined,
    incomplete,
  }
}

/** Turn a search result into a food for the user's own library. */
export function toFood(found: SearchedFood, id: string, createdAt: string): Food {
  return {
    id,
    name: found.name,
    ...(found.brand ? { brand: found.brand } : {}),
    category: 'From search',
    per100g: found.per100g,
    ...(found.defaultServing ? { defaultServing: found.defaultServing } : {}),
    source: 'user',
    createdAt,
  }
}

/** Shared cooldown so one rate-limit response pauses every caller. */
let cooldownUntil = 0
export const rateLimitedUntil = () => cooldownUntil
export const clearRateLimit = () => {
  cooldownUntil = 0
}

export async function searchFoods(
  query: string,
  {
    signal,
    apiKey = DEMO_API_KEY,
    limit = 20,
  }: { signal?: AbortSignal; apiKey?: string; limit?: number } = {},
): Promise<SearchedFood[]> {
  const terms = query.trim()
  if (terms.length < 2) return []

  if (Date.now() < cooldownUntil) throw new RateLimitedError(cooldownUntil)

  const url =
    `${SEARCH_URL}?api_key=${encodeURIComponent(apiKey || DEMO_API_KEY)}` +
    `&query=${encodeURIComponent(terms)}&pageSize=${limit}` +
    // Survey (FNDDS) is what carries prepared dishes — "egg omelet or
    // scrambled egg" rather than just "egg, raw" — so searches for something
    // cooked return something useful.
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS),Branded')}`

  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new LookupFailedError()
  }

  // 403 is what the API returns when a key is exhausted or wrong.
  if (response.status === 429 || response.status === 403) {
    cooldownUntil = Date.now() + 60_000
    throw new RateLimitedError(cooldownUntil)
  }
  if (!response.ok) throw new LookupFailedError()

  let data: { foods?: unknown }
  try {
    data = (await response.json()) as { foods?: unknown }
  } catch {
    throw new LookupFailedError()
  }

  const foods = Array.isArray(data.foods) ? data.foods : []
  return foods
    .map((food) => (typeof food === 'object' && food !== null ? toSearchedFood(food as Record<string, unknown>) : null))
    .filter((food): food is SearchedFood => food !== null)
}
