import type { Food, Nutrients, Serving } from '../domain/types'
import { ZERO_NUTRIENTS, round } from '../domain/nutrition'

/**
 * Open Food Facts client.
 *
 * Free, no API key, CORS-open, and the best coverage of UK supermarket
 * barcodes — which keeps the app's "no infrastructure" promise intact.
 *
 * Barcode lookup only. Every Open Food Facts SEARCH endpoint refuses
 * cross-origin browser requests — `cgi/search.pl` answers 503 as soon as an
 * `Origin` header is present, and the newer search service sends no
 * `access-control-allow-origin` header — so free-text search lives in
 * `foodDataCentral.ts` instead. The product endpoint does send proper CORS
 * headers, and has the best coverage of UK supermarket barcodes.
 */

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'

const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity,quantity'

/** Product lookups allow ~100/min; back off for a minute if we ever trip it. */
const RATE_LIMIT_COOLDOWN_MS = 60_000

export class RateLimitedError extends Error {
  readonly retryAt: number
  constructor(retryAt: number) {
    super('Open Food Facts is rate limiting us. Try again in a moment.')
    this.name = 'RateLimitedError'
    this.retryAt = retryAt
  }
}

export class LookupFailedError extends Error {
  constructor(message = 'Could not reach the food database.') {
    super(message)
    this.name = 'LookupFailedError'
  }
}

export interface RemoteProduct {
  barcode: string
  name: string
  brand?: string
  per100g: Nutrients
  defaultServing?: Serving
  /** True when the record had no usable energy value. */
  incomplete: boolean
}

/* ------------------------------------------------------------------ */
/* Rate-limit state — shared, so one 429 pauses every caller            */
/* ------------------------------------------------------------------ */

let cooldownUntil = 0

export function rateLimitedUntil(): number {
  return cooldownUntil
}

/** Exposed for tests; also used when the user explicitly retries. */
export function clearRateLimit(): void {
  cooldownUntil = 0
}

function assertNotCoolingDown(): void {
  if (Date.now() < cooldownUntil) throw new RateLimitedError(cooldownUntil)
}

/* ------------------------------------------------------------------ */
/* Response mapping                                                     */
/* ------------------------------------------------------------------ */

const asNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

/** Pull grams out of a serving string such as "30 g" or "1 slice (44g)". */
export function parseServingGrams(serving: unknown, quantity?: unknown): number | undefined {
  const direct = asNumber(quantity)
  if (direct && direct > 0) return round(direct, 1)
  if (typeof serving !== 'string') return undefined
  const match = serving.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)
  if (!match) return undefined
  const grams = Number.parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(grams) && grams > 0 ? round(grams, 1) : undefined
}

export function toNutrients(source: Record<string, unknown> | null | undefined): {
  per100g: Nutrients
  incomplete: boolean
} {
  const nutriments = source ?? {}
  const kcalDirect = asNumber(nutriments['energy-kcal_100g'])
  // Some records only carry kilojoules.
  const kj = asNumber(nutriments['energy_100g'])
  const kcal = kcalDirect ?? (kj !== undefined ? kj / 4.184 : undefined)

  // Salt and sodium are interchangeable: salt = sodium x 2.5.
  const salt = asNumber(nutriments['salt_100g'])
  const sodium = asNumber(nutriments['sodium_100g'])

  const per100g: Nutrients = {
    ...ZERO_NUTRIENTS,
    kcal: round(kcal ?? 0, 0),
    fat: round(asNumber(nutriments['fat_100g']) ?? 0, 1),
    satFat: round(asNumber(nutriments['saturated-fat_100g']) ?? 0, 1),
    carbs: round(asNumber(nutriments['carbohydrates_100g']) ?? 0, 1),
    fibre: round(asNumber(nutriments['fiber_100g']) ?? 0, 1),
    protein: round(asNumber(nutriments['proteins_100g']) ?? 0, 1),
    salt: round(salt ?? (sodium !== undefined ? sodium * 2.5 : 0), 2),
  }

  // Saturated fat above total fat is a data error in the source; clamp rather
  // than import something that fails our own validation.
  if (per100g.satFat > per100g.fat) per100g.satFat = per100g.fat

  return { per100g, incomplete: kcal === undefined || kcal <= 0 }
}

export function toRemoteProduct(value: unknown): RemoteProduct | null {
  // The feed is public data of mixed quality; a null or a bare string in the
  // products array must skip that row, not fail the whole search.
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>

  const barcode = typeof raw.code === 'string' ? raw.code : undefined
  const name = typeof raw.product_name === 'string' ? raw.product_name.trim() : ''
  if (!barcode || name === '') return null

  const nutriments = raw.nutriments
  const { per100g, incomplete } = toNutrients(
    typeof nutriments === 'object' && nutriments !== null
      ? (nutriments as Record<string, unknown>)
      : {},
  )

  const brandField = typeof raw.brands === 'string' ? raw.brands : ''
  const brand = brandField.split(',')[0]?.trim() || undefined

  const grams = parseServingGrams(raw.serving_size, raw.serving_quantity)

  return {
    barcode,
    name,
    brand,
    per100g,
    defaultServing:
      grams !== undefined
        ? { label: typeof raw.serving_size === 'string' && raw.serving_size.trim() ? raw.serving_size.trim() : `${grams} g serving`, grams }
        : undefined,
    incomplete,
  }
}

/** Turn a looked-up product into a food for the user's own library. */
export function toFood(product: RemoteProduct, id: string, createdAt: string): Food {
  return {
    id,
    name: product.name,
    ...(product.brand ? { brand: product.brand } : {}),
    category: 'From barcode',
    per100g: product.per100g,
    ...(product.defaultServing ? { defaultServing: product.defaultServing } : {}),
    source: 'user',
    createdAt,
  }
}

/* ------------------------------------------------------------------ */
/* Requests                                                             */
/* ------------------------------------------------------------------ */

async function request(url: string, signal?: AbortSignal): Promise<unknown> {
  assertNotCoolingDown()

  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new LookupFailedError()
  }

  if (response.status === 429 || response.status === 503) {
    // Back off for everyone, then recover on its own without the user doing
    // anything: the next search after the cooldown just works.
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10)
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : RATE_LIMIT_COOLDOWN_MS
    cooldownUntil = Date.now() + waitMs
    throw new RateLimitedError(cooldownUntil)
  }

  if (!response.ok) throw new LookupFailedError()

  try {
    return await response.json()
  } catch {
    throw new LookupFailedError()
  }
}

export async function getProductByBarcode(
  barcode: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<RemoteProduct | null> {
  const code = barcode.replace(/\D/g, '')
  if (code.length < 6) return null

  const data = (await request(`${PRODUCT_URL}/${code}.json?fields=${FIELDS}`, signal)) as {
    status?: number
    product?: unknown
  }
  if (data.status !== 1 || typeof data.product !== 'object' || data.product === null) return null

  return toRemoteProduct({ code, ...(data.product as Record<string, unknown>) })
}
