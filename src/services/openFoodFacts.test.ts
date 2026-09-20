import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LookupFailedError,
  RateLimitedError,
  clearRateLimit,
  getProductByBarcode,
  parseServingGrams,
  rateLimitedUntil,
  toFood,
  toNutrients,
  toRemoteProduct,
} from './openFoodFacts'

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init })

beforeEach(() => {
  clearRateLimit()
  vi.restoreAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('toNutrients', () => {
  it('maps the Open Food Facts field names', () => {
    const { per100g } = toNutrients({
      'energy-kcal_100g': 450,
      fat_100g: 16.8,
      'saturated-fat_100g': 8.38,
      carbohydrates_100g: 70,
      fiber_100g: 1.24,
      proteins_100g: 4.04,
      salt_100g: 0.42,
    })
    expect(per100g).toEqual({
      kcal: 450,
      fat: 16.8,
      satFat: 8.4,
      carbs: 70,
      fibre: 1.2,
      protein: 4,
      salt: 0.42,
    })
  })

  it('converts kilojoules when kcal is missing', () => {
    const { per100g } = toNutrients({ energy_100g: 2000 })
    expect(per100g.kcal).toBe(478) // 2000 / 4.184
  })

  it('derives salt from sodium when salt is absent', () => {
    const { per100g } = toNutrients({ sodium_100g: 0.4 })
    expect(per100g.salt).toBe(1) // sodium x 2.5
  })

  it('defaults missing nutrients to zero rather than NaN', () => {
    const { per100g } = toNutrients({})
    expect(Object.values(per100g).every(Number.isFinite)).toBe(true)
    expect(per100g.fibre).toBe(0)
  })

  it('ignores negative and non-numeric values', () => {
    const { per100g } = toNutrients({ fat_100g: -5, proteins_100g: 'lots' })
    expect(per100g.fat).toBe(0)
    expect(per100g.protein).toBe(0)
  })

  it('accepts numbers that arrive as strings', () => {
    const { per100g } = toNutrients({ 'energy-kcal_100g': '250', fat_100g: '3.5' })
    expect(per100g.kcal).toBe(250)
    expect(per100g.fat).toBe(3.5)
  })

  it('clamps saturated fat that exceeds total fat in the source data', () => {
    const { per100g } = toNutrients({ fat_100g: 2, 'saturated-fat_100g': 9 })
    expect(per100g.satFat).toBe(2)
  })

  it('flags a record with no usable energy value', () => {
    expect(toNutrients({}).incomplete).toBe(true)
    expect(toNutrients({ 'energy-kcal_100g': 100 }).incomplete).toBe(false)
  })
})

describe('parseServingGrams', () => {
  it('prefers the numeric quantity field', () => {
    expect(parseServingGrams('1 slice', 44)).toBe(44)
  })

  it('reads grams out of a serving string', () => {
    expect(parseServingGrams('30 g')).toBe(30)
    expect(parseServingGrams('1 slice (44g)')).toBe(44)
    expect(parseServingGrams('12,5 g')).toBe(12.5)
  })

  it('returns undefined when there is nothing usable', () => {
    expect(parseServingGrams('1 slice')).toBeUndefined()
    expect(parseServingGrams(undefined)).toBeUndefined()
    expect(parseServingGrams('250 ml')).toBeUndefined()
  })
})

describe('toRemoteProduct', () => {
  const raw = {
    code: '5000159407236',
    product_name: '  Mars  ',
    brands: 'Mars, Mars Wrigley',
    nutriments: { 'energy-kcal_100g': 450 },
    serving_size: '51 g',
  }

  it('maps a product record', () => {
    const product = toRemoteProduct(raw)
    expect(product?.barcode).toBe('5000159407236')
    expect(product?.name).toBe('Mars')
    expect(product?.brand).toBe('Mars') // first brand only
    expect(product?.defaultServing).toEqual({ label: '51 g', grams: 51 })
  })

  it('rejects a record with no code or no name', () => {
    expect(toRemoteProduct({ ...raw, code: undefined })).toBeNull()
    expect(toRemoteProduct({ ...raw, product_name: '   ' })).toBeNull()
  })

  it('survives junk in place of a record', () => {
    // The feed is crowd-sourced and has returned nulls in the products array.
    expect(toRemoteProduct(null)).toBeNull()
    expect(toRemoteProduct(undefined)).toBeNull()
    expect(toRemoteProduct('a string')).toBeNull()
    expect(toRemoteProduct([])).toBeNull()
  })

  it('survives a record whose nutriments are missing or not an object', () => {
    expect(toRemoteProduct({ code: '1', product_name: 'X' })?.per100g.kcal).toBe(0)
    expect(toRemoteProduct({ code: '1', product_name: 'X', nutriments: null })?.per100g.kcal).toBe(0)
  })

  it('converts to a user food', () => {
    const product = toRemoteProduct(raw)
    const food = toFood(product!, 'id-1', '2026-09-20T00:00:00.000Z')
    expect(food.source).toBe('user')
    expect(food.category).toBe('From barcode')
    expect(food.name).toBe('Mars')
  })
})

describe('rate limiting', () => {
  it('raises RateLimitedError on a 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }))
    await expect(getProductByBarcode('5000159407236')).rejects.toBeInstanceOf(RateLimitedError)
  })

  it('stops calling the network while cooling down', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 429 }))

    await expect(getProductByBarcode('5000159407236')).rejects.toBeInstanceOf(RateLimitedError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // The second scan short-circuits: no further requests while limited.
    await expect(getProductByBarcode('5000157024671')).rejects.toBeInstanceOf(RateLimitedError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('recovers by itself once the cooldown expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '30' } }))
    await expect(getProductByBarcode('5000159407236')).rejects.toBeInstanceOf(RateLimitedError)

    vi.setSystemTime(new Date('2026-09-20T12:00:31Z'))
    fetchSpy.mockResolvedValueOnce(json({ status: 1, product: { product_name: 'Bread', nutriments: {} } }))

    const product = await getProductByBarcode('5000159407236')
    expect(product?.name).toBe('Bread')
  })

  it('honours the retry-after header', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 429, headers: { 'retry-after': '120' } }),
    )
    await expect(getProductByBarcode('5000159407236')).rejects.toBeInstanceOf(RateLimitedError)
    expect(rateLimitedUntil()).toBe(Date.parse('2026-09-20T12:02:00Z'))
  })

  it('treats a 503 as rate limiting too', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    await expect(getProductByBarcode('5000159407236')).rejects.toBeInstanceOf(RateLimitedError)
  })
})

describe('getProductByBarcode', () => {
  it('returns a product when found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ status: 1, product: { product_name: 'Beans', nutriments: { 'energy-kcal_100g': 78 } } }),
    )
    const product = await getProductByBarcode('5000157024671')
    expect(product?.name).toBe('Beans')
    expect(product?.barcode).toBe('5000157024671')
  })

  it('returns null for an unknown barcode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ status: 0 }))
    expect(await getProductByBarcode('0000000000000')).toBeNull()
  })

  it('rejects an obviously invalid barcode without a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await getProductByBarcode('123')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('strips non-digits before looking up', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ status: 1, product: { product_name: 'X', nutriments: {} } }))
    await getProductByBarcode(' 5000-157 024671 ')
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/5000157024671.json')
  })

  it('raises LookupFailedError when the network is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    await expect(getProductByBarcode('5000159407236')).rejects.toBeInstanceOf(LookupFailedError)
  })
})
