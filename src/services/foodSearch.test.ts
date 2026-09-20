import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchAllSources, toFood } from './foodSearch'
import * as off from './openFoodFacts'
import * as fdc from './foodDataCentral'
import { LookupFailedError, RateLimitedError } from './openFoodFacts'
import { ZERO_NUTRIENTS } from '../domain/nutrition'

const offProduct = (name: string, barcode = '1'): off.RemoteProduct => ({
  barcode,
  name,
  brand: 'Hovis',
  per100g: { ...ZERO_NUTRIENTS, kcal: 220 },
  incomplete: false,
})

const fdcFood = (name: string, id = '1'): fdc.SearchedFood => ({
  id,
  name,
  per100g: { ...ZERO_NUTRIENTS, kcal: 155 },
  incomplete: false,
})

beforeEach(() => vi.restoreAllMocks())

describe('searchAllSources', () => {
  it('merges both sources, branded first', async () => {
    vi.spyOn(off, 'searchProducts').mockResolvedValue([offProduct('Seed Sensations')])
    vi.spyOn(fdc, 'searchFoods').mockResolvedValue([fdcFood('Egg, fried')])

    const { foods, partial, failure } = await searchAllSources('eggs')

    expect(failure).toBeNull()
    expect(partial).toBe(false)
    expect(foods.map((food) => food.name)).toEqual(['Seed Sensations', 'Egg, fried'])
    expect(foods[0].source).toBe('openfoodfacts')
    expect(foods[1].source).toBe('fdc')
  })

  it('keeps going when the branded source fails', async () => {
    // Open Food Facts throttles browsers hard; a failure there must not empty
    // the results, only shorten them.
    vi.spyOn(off, 'searchProducts').mockRejectedValue(new LookupFailedError())
    vi.spyOn(fdc, 'searchFoods').mockResolvedValue([fdcFood('Egg, fried')])

    const { foods, partial, failure } = await searchAllSources('eggs')

    expect(failure).toBeNull()
    expect(partial).toBe(true)
    expect(foods).toHaveLength(1)
    expect(foods[0].source).toBe('fdc')
  })

  it('keeps going when the generic source fails', async () => {
    vi.spyOn(off, 'searchProducts').mockResolvedValue([offProduct('Hovis Wholemeal')])
    vi.spyOn(fdc, 'searchFoods').mockRejectedValue(new RateLimitedError(Date.now() + 1000))

    const { foods, partial, failure } = await searchAllSources('hovis')

    expect(failure).toBeNull()
    expect(partial).toBe(true)
    expect(foods[0].brand).toBe('Hovis')
  })

  it('reports failure only when both sources fail', async () => {
    vi.spyOn(off, 'searchProducts').mockRejectedValue(new LookupFailedError())
    vi.spyOn(fdc, 'searchFoods').mockRejectedValue(new LookupFailedError())

    const { foods, failure } = await searchAllSources('eggs')
    expect(failure).toBe('unavailable')
    expect(foods).toEqual([])
  })

  it('distinguishes rate limiting from being unreachable', async () => {
    vi.spyOn(off, 'searchProducts').mockRejectedValue(new RateLimitedError(Date.now() + 1000))
    vi.spyOn(fdc, 'searchFoods').mockRejectedValue(new RateLimitedError(Date.now() + 1000))

    expect((await searchAllSources('eggs')).failure).toBe('rate-limited')
  })

  it('drops a duplicate that both sources returned', async () => {
    vi.spyOn(off, 'searchProducts').mockResolvedValue([offProduct('Wholemeal Bread')])
    vi.spyOn(fdc, 'searchFoods').mockResolvedValue([
      { ...fdcFood('Wholemeal Bread'), brand: 'Hovis' },
    ])

    const { foods } = await searchAllSources('bread')
    expect(foods).toHaveLength(1)
    expect(foods[0].source).toBe('openfoodfacts')
  })

  it('keeps same-named foods from different brands', async () => {
    vi.spyOn(off, 'searchProducts').mockResolvedValue([
      { ...offProduct('Wholemeal Bread', '1'), brand: 'Hovis' },
      { ...offProduct('Wholemeal Bread', '2'), brand: 'Warburtons' },
    ])
    vi.spyOn(fdc, 'searchFoods').mockResolvedValue([])

    expect((await searchAllSources('bread')).foods).toHaveLength(2)
  })

  it('does not call either source for a one-character query', async () => {
    const offSpy = vi.spyOn(off, 'searchProducts')
    const fdcSpy = vi.spyOn(fdc, 'searchFoods')

    expect((await searchAllSources('a')).foods).toEqual([])
    expect(offSpy).not.toHaveBeenCalled()
    expect(fdcSpy).not.toHaveBeenCalled()
  })

  it('queries both sources at once rather than one after the other', async () => {
    const order: string[] = []
    vi.spyOn(off, 'searchProducts').mockImplementation(async () => {
      order.push('off-start')
      await new Promise((resolve) => setTimeout(resolve, 20))
      return []
    })
    vi.spyOn(fdc, 'searchFoods').mockImplementation(async () => {
      order.push('fdc-start')
      return []
    })

    await searchAllSources('bread')
    // Both start before either finishes.
    expect(order).toEqual(['off-start', 'fdc-start'])
  })
})

describe('toFood', () => {
  it('carries the barcode through for a branded hit', () => {
    const food = toFood(
      {
        key: 'off:123',
        name: 'Hovis Wholemeal',
        brand: 'Hovis',
        per100g: { ...ZERO_NUTRIENTS },
        incomplete: false,
        source: 'openfoodfacts',
        barcode: '5000159407236',
      },
      'id-1',
      '2026-09-20T00:00:00.000Z',
    )
    expect(food.barcode).toBe('5000159407236')
    expect(food.source).toBe('user')
  })

  it('leaves the barcode off a generic hit', () => {
    const food = toFood(
      {
        key: 'fdc:1',
        name: 'Egg, fried',
        per100g: { ...ZERO_NUTRIENTS },
        incomplete: false,
        source: 'fdc',
      },
      'id-2',
      '2026-09-20T00:00:00.000Z',
    )
    expect(food.barcode).toBeUndefined()
  })
})
