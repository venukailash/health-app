import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS } from '../../domain/types'
import { SEED_VERSION, missingSeedFoods, seedFoods } from './index'

describe('seed foods', () => {
  it('ships a usable starter library', () => {
    expect(seedFoods.length).toBeGreaterThan(100)
    expect(SEED_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('gives every food a unique id and the seed source', () => {
    const ids = new Set(seedFoods.map((food) => food.id))
    expect(ids.size).toBe(seedFoods.length)
    expect(seedFoods.every((food) => food.source === 'seed')).toBe(true)
  })

  it('gives every food a name and a category', () => {
    for (const food of seedFoods) {
      expect(food.name.trim()).not.toBe('')
      expect(food.category?.trim()).toBeTruthy()
    }
  })

  it('has finite, non-negative values for every nutrient', () => {
    for (const food of seedFoods) {
      for (const key of NUTRIENT_KEYS) {
        const value = food.per100g[key]
        expect(Number.isFinite(value), `${food.name}.${key}`).toBe(true)
        expect(value, `${food.name}.${key}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('never reports more saturated fat than total fat', () => {
    for (const food of seedFoods) {
      expect(food.per100g.satFat, food.name).toBeLessThanOrEqual(food.per100g.fat)
    }
  })

  it('uses positive gram weights for any default serving', () => {
    for (const food of seedFoods) {
      if (!food.defaultServing) continue
      expect(food.defaultServing.grams, food.name).toBeGreaterThan(0)
      expect(food.defaultServing.label.trim(), food.name).not.toBe('')
    }
  })

  it('keeps stated calories close to the energy from its macros', () => {
    // Catches transposed or mistyped figures. Alcohol carries 7 kcal/g and is
    // not one of our tracked macros, so alcoholic drinks are exempt by design
    // rather than by loosening the tolerance for every other food.
    const ALCOHOLIC = new Set(['seed-red-wine', 'seed-lager-4'])
    for (const food of seedFoods) {
      if (ALCOHOLIC.has(food.id)) continue
      const { kcal, fat, carbs, protein } = food.per100g
      const fromMacros = fat * 9 + carbs * 4 + protein * 4
      const tolerance = Math.max(60, kcal * 0.35)
      expect(Math.abs(kcal - fromMacros), `${food.name} (${kcal} kcal vs ${fromMacros})`)
        .toBeLessThanOrEqual(tolerance)
    }
  })
})

describe('missingSeedFoods', () => {
  it('returns everything for an empty library', () => {
    expect(missingSeedFoods([])).toHaveLength(seedFoods.length)
  })

  it('skips seed foods the user already has', () => {
    const [first, second] = seedFoods
    expect(missingSeedFoods([first, second])).toHaveLength(seedFoods.length - 2)
  })

  it('returns nothing once every seed food is present', () => {
    expect(missingSeedFoods(seedFoods)).toEqual([])
  })

  it('ignores unrelated user foods', () => {
    const userFood = {
      ...seedFoods[0],
      id: 'user-1',
      source: 'user' as const,
    }
    expect(missingSeedFoods([userFood])).toHaveLength(seedFoods.length)
  })
})
