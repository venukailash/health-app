import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_API_KEY,
  clearRateLimit,
  rateLimitedUntil,
  searchFoods,
  tidyName,
  toFood,
  toNutrients,
  toSearchedFood,
} from './foodDataCentral'
import { LookupFailedError, RateLimitedError } from './openFoodFacts'

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init })

const nutrient = (nutrientNumber: string, value: number) => ({ nutrientNumber, value })

beforeEach(() => {
  clearRateLimit()
  vi.restoreAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('toNutrients', () => {
  it('maps USDA nutrient numbers', () => {
    const { per100g } = toNutrients([
      nutrient('208', 250), // energy kcal
      nutrient('204', 10), // fat
      nutrient('606', 4), // saturated fat
      nutrient('205', 30), // carbohydrate by difference
      nutrient('291', 5), // fibre
      nutrient('203', 8), // protein
      nutrient('307', 400), // sodium mg
    ])

    expect(per100g.kcal).toBe(250)
    expect(per100g.fat).toBe(10)
    expect(per100g.satFat).toBe(4)
    expect(per100g.protein).toBe(8)
    expect(per100g.fibre).toBe(5)
  })

  it('takes fibre out of carbohydrate, because USDA includes it and UK labels do not', () => {
    // 30 g "carbohydrate by difference" containing 5 g fibre is 25 g of
    // carbohydrate the UK way. Counting both would double-count the fibre.
    const { per100g } = toNutrients([nutrient('205', 30), nutrient('291', 5)])
    expect(per100g.carbs).toBe(25)
    expect(per100g.fibre).toBe(5)
  })

  it('never drives carbohydrate below zero when fibre exceeds it', () => {
    const { per100g } = toNutrients([nutrient('205', 2), nutrient('291', 9)])
    expect(per100g.carbs).toBe(0)
  })

  it('converts sodium in milligrams to salt in grams', () => {
    // 400 mg sodium x 2.5 = 1000 mg salt = 1 g.
    const { per100g } = toNutrients([nutrient('307', 400)])
    expect(per100g.salt).toBe(1)
  })

  it('defaults anything missing to zero rather than NaN', () => {
    const { per100g } = toNutrients([])
    expect(Object.values(per100g).every(Number.isFinite)).toBe(true)
  })

  it('clamps saturated fat above total fat', () => {
    const { per100g } = toNutrients([nutrient('204', 3), nutrient('606', 9)])
    expect(per100g.satFat).toBe(3)
  })

  it('flags a record with no energy value', () => {
    expect(toNutrients([]).incomplete).toBe(true)
    expect(toNutrients([nutrient('208', 100)]).incomplete).toBe(false)
  })
})

describe('tidyName', () => {
  it('title-cases the shouty branded descriptions', () => {
    expect(tidyName('CRISP BREAD WHOLEMEAL')).toBe('Crisp Bread Wholemeal')
  })

  it('leaves a normally-cased name alone', () => {
    expect(tidyName('Bread, wholemeal')).toBe('Bread, wholemeal')
  })

  it('trims surrounding space', () => {
    expect(tidyName('  BEANS  ')).toBe('Beans')
  })
})

describe('toSearchedFood', () => {
  const raw = {
    fdcId: 12345,
    description: 'WHOLEMEAL BREAD',
    brandOwner: 'HOVIS',
    servingSize: 44,
    servingSizeUnit: 'g',
    foodNutrients: [nutrient('208', 220), nutrient('205', 40), nutrient('291', 7)],
  }

  it('maps a search hit', () => {
    const food = toSearchedFood(raw)
    expect(food?.id).toBe('12345')
    expect(food?.name).toBe('Wholemeal Bread')
    expect(food?.brand).toBe('Hovis')
    expect(food?.defaultServing).toEqual({ label: '44 g serving', grams: 44 })
    expect(food?.per100g.carbs).toBe(33) // 40 - 7 fibre
  })

  it('ignores a serving size that is not in grams', () => {
    expect(toSearchedFood({ ...raw, servingSizeUnit: 'ml' })?.defaultServing).toBeUndefined()
  })

  it('rejects a record with no description or id', () => {
    expect(toSearchedFood({ ...raw, description: '  ' })).toBeNull()
    expect(toSearchedFood({ ...raw, fdcId: undefined })).toBeNull()
  })

  it('converts to a user food', () => {
    const food = toFood(toSearchedFood(raw)!, 'id-1', '2026-09-20T00:00:00.000Z')
    expect(food.source).toBe('user')
    expect(food.category).toBe('From search')
    expect(food.brand).toBe('Hovis')
  })
})

describe('searchFoods', () => {
  it('returns mapped results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ foods: [{ fdcId: 1, description: 'BANANA', foodNutrients: [nutrient('208', 89)] }] }),
    )
    const results = await searchFoods('banana')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Banana')
  })

  it('skips unusable rows rather than failing the search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ foods: [{ fdcId: 1, description: 'Good', foodNutrients: [] }, null, 'junk', {}] }),
    )
    expect(await searchFoods('mixed')).toHaveLength(1)
  })

  it('does not call the network for a one-character query', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await searchFoods('a')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('uses the demo key when none is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ foods: [] }))
    await searchFoods('banana')
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`api_key=${DEMO_API_KEY}`)
  })

  it('uses a personal key when one is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ foods: [] }))
    await searchFoods('banana', { apiKey: 'MY-KEY' })
    expect(String(fetchSpy.mock.calls[0][0])).toContain('api_key=MY-KEY')
  })

  it('raises LookupFailedError when the network is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    await expect(searchFoods('banana')).rejects.toBeInstanceOf(LookupFailedError)
  })

  it('treats an exhausted key (403) as rate limiting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }))
    await expect(searchFoods('banana')).rejects.toBeInstanceOf(RateLimitedError)
  })

  it('stops calling the network while cooling down, then recovers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 429 }))
    await expect(searchFoods('banana')).rejects.toBeInstanceOf(RateLimitedError)

    await expect(searchFoods('apple')).rejects.toBeInstanceOf(RateLimitedError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(rateLimitedUntil()).toBeGreaterThan(Date.now())

    // A minute later the next search simply works again.
    vi.setSystemTime(new Date('2026-09-20T12:01:01Z'))
    fetchSpy.mockResolvedValueOnce(json({ foods: [{ fdcId: 2, description: 'Apple', foodNutrients: [] }] }))
    expect(await searchFoods('apple')).toHaveLength(1)
  })
})
