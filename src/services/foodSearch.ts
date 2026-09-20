import type { Food, Nutrients, Serving } from '../domain/types'
import { LookupFailedError, RateLimitedError, searchProducts } from './openFoodFacts'
import { searchFoods } from './foodDataCentral'

/**
 * One search across both food databases.
 *
 * Neither source alone covers what people type. Open Food Facts has the UK
 * supermarket products — Hovis, Warburtons — but nothing for "scrambled eggs";
 * FoodData Central has generic ingredients and cooked dishes but is US-centric
 * and lists almost no UK brands.
 *
 * They are queried in parallel and whichever answers is used, so the flakier
 * of the two (Open Food Facts, which throttles browsers hard) degrades the
 * results instead of emptying them.
 */

export interface FoundFood {
  key: string
  name: string
  brand?: string
  per100g: Nutrients
  defaultServing?: Serving
  incomplete: boolean
  source: 'openfoodfacts' | 'fdc'
  barcode?: string
}

export interface CombinedResults {
  foods: FoundFood[]
  /** Set when at least one source failed but the other answered. */
  partial: boolean
  /** Both sources failed. */
  failure: 'rate-limited' | 'unavailable' | null
}

export function toFood(found: FoundFood, id: string, createdAt: string): Food {
  return {
    id,
    name: found.name,
    ...(found.brand ? { brand: found.brand } : {}),
    ...(found.barcode ? { barcode: found.barcode } : {}),
    category: found.source === 'openfoodfacts' ? 'From barcode database' : 'From food search',
    per100g: found.per100g,
    ...(found.defaultServing ? { defaultServing: found.defaultServing } : {}),
    source: 'user',
    createdAt,
  }
}

/** Branded products first: someone typing "hovis" wants the packet, not an ingredient. */
function interleave(branded: FoundFood[], generic: FoundFood[]): FoundFood[] {
  const seen = new Set<string>()
  const unique = (food: FoundFood) => {
    const key = `${food.name.toLowerCase()}|${(food.brand ?? '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
  return [...branded.filter(unique), ...generic.filter(unique)]
}

export async function searchAllSources(
  query: string,
  { signal, apiKey }: { signal?: AbortSignal; apiKey?: string } = {},
): Promise<CombinedResults> {
  const terms = query.trim()
  if (terms.length < 2) return { foods: [], partial: false, failure: null }

  const [off, fdc] = await Promise.allSettled([
    searchProducts(terms, { signal, limit: 15 }),
    searchFoods(terms, { signal, apiKey, limit: 15 }),
  ])

  if (signal?.aborted) return { foods: [], partial: false, failure: null }

  const branded: FoundFood[] =
    off.status === 'fulfilled'
      ? off.value.map((product) => ({
          key: `off:${product.barcode}`,
          name: product.name,
          brand: product.brand,
          per100g: product.per100g,
          defaultServing: product.defaultServing,
          incomplete: product.incomplete,
          source: 'openfoodfacts' as const,
          barcode: product.barcode,
        }))
      : []

  const generic: FoundFood[] =
    fdc.status === 'fulfilled'
      ? fdc.value.map((food) => ({
          key: `fdc:${food.id}`,
          name: food.name,
          brand: food.brand,
          per100g: food.per100g,
          defaultServing: food.defaultServing,
          incomplete: food.incomplete,
          source: 'fdc' as const,
        }))
      : []

  const failed = [off, fdc].filter((result) => result.status === 'rejected')

  if (failed.length === 2) {
    const rateLimited = failed.some(
      (result) => (result as PromiseRejectedResult).reason instanceof RateLimitedError,
    )
    return { foods: [], partial: false, failure: rateLimited ? 'rate-limited' : 'unavailable' }
  }

  return {
    foods: interleave(branded, generic),
    partial: failed.length === 1,
    failure: null,
  }
}

export { LookupFailedError, RateLimitedError }
