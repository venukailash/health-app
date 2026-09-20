import { describe, expect, it } from 'vitest'
import {
  ZERO_NUTRIENTS,
  addNutrients,
  kcalFromMacros,
  percentOfGoal,
  perServing,
  recipePerServing,
  recipeTotals,
  round,
  roundNutrients,
  scaleNutrients,
  sumNutrients,
  unsaturatedFat,
} from './nutrition'
import type { Food, Nutrients } from './types'

const oats: Nutrients = { kcal: 379, fat: 6.5, satFat: 1.1, carbs: 67.7, fibre: 0, protein: 13.2, salt: 0.02 }

const makeFood = (id: string, name: string, per100g: Nutrients): Food => ({
  id,
  name,
  per100g,
  source: 'user',
  createdAt: '2026-09-20T08:00:00.000Z',
})

describe('round', () => {
  it('rounds to one decimal place by default', () => {
    expect(round(6.44)).toBe(6.4)
    expect(round(6.45)).toBe(6.5)
  })

  it('removes floating point dust', () => {
    expect(round(0.1 + 0.2, 2)).toBe(0.3)
  })

  it('returns 0 for non-finite input', () => {
    expect(round(Number.NaN)).toBe(0)
    expect(round(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('scaleNutrients', () => {
  it('scales per-100g values to a gram weight', () => {
    const result = roundNutrients(scaleNutrients(oats, 40))
    expect(result).toEqual({ kcal: 152, fat: 2.6, satFat: 0.4, carbs: 27.1, fibre: 0, protein: 5.3, salt: 0.01 })
  })

  it('returns the same values at exactly 100 g', () => {
    expect(scaleNutrients(oats, 100)).toEqual(oats)
  })

  it('returns zeros for 0 g and for non-finite weights', () => {
    expect(scaleNutrients(oats, 0)).toEqual(ZERO_NUTRIENTS)
    expect(scaleNutrients(oats, Number.NaN)).toEqual(ZERO_NUTRIENTS)
  })

  it('does not mutate its input', () => {
    const copy = { ...oats }
    scaleNutrients(oats, 250)
    expect(oats).toEqual(copy)
  })
})

describe('addNutrients / sumNutrients', () => {
  it('adds every nutrient key', () => {
    const a: Nutrients = { kcal: 100, fat: 1, satFat: 0.5, carbs: 10, fibre: 0, protein: 5, salt: 0.1 }
    const b: Nutrients = { kcal: 50, fat: 2, satFat: 0.25, carbs: 3, fibre: 0, protein: 1, salt: 0.4 }
    expect(addNutrients(a, b)).toEqual({
      kcal: 150,
      fat: 3,
      satFat: 0.75,
      carbs: 13,
      fibre: 0,
      protein: 6,
      salt: 0.5,
    })
  })

  it('sums an empty list to zero', () => {
    expect(sumNutrients([])).toEqual(ZERO_NUTRIENTS)
  })

  it('sums a list of entries', () => {
    const totals = sumNutrients([scaleNutrients(oats, 50), scaleNutrients(oats, 50)])
    expect(roundNutrients(totals)).toEqual(roundNutrients(oats))
  })
})

describe('unsaturatedFat', () => {
  it('derives unsaturated fat from total minus saturated', () => {
    expect(unsaturatedFat({ fat: 10, satFat: 3 })).toBe(7)
  })

  it('never goes negative when saturated exceeds total', () => {
    expect(unsaturatedFat({ fat: 2, satFat: 5 })).toBe(0)
  })

  it('treats a zero-fat food as zero unsaturated', () => {
    expect(unsaturatedFat({ fat: 0, satFat: 0 })).toBe(0)
  })
})

describe('recipeTotals and perServing', () => {
  const chicken = makeFood('f1', 'Chicken breast', {
    kcal: 165,
    fat: 3.6,
    satFat: 1,
    carbs: 0,
    fibre: 0,
    protein: 31,
    salt: 0.1,
  })
  const rice = makeFood('f2', 'Rice, cooked', {
    kcal: 130,
    fat: 0.3,
    satFat: 0.1,
    carbs: 28,
    fibre: 0,
    protein: 2.7,
    salt: 0,
  })
  const foods = new Map([
    [chicken.id, chicken],
    [rice.id, rice],
  ])

  it('totals all ingredients', () => {
    const totals = recipeTotals(
      [
        { foodId: 'f1', grams: 200 },
        { foodId: 'f2', grams: 300 },
      ],
      foods,
    )
    expect(roundNutrients(totals)).toEqual({
      kcal: 720,
      fat: 8.1,
      satFat: 2.3,
      carbs: 84,
      fibre: 0,
      protein: 70.1,
      salt: 0.2,
    })
  })

  it('accepts a plain object lookup as well as a Map', () => {
    const viaObject = recipeTotals([{ foodId: 'f1', grams: 100 }], { f1: chicken, f2: rice })
    expect(viaObject).toEqual(chicken.per100g)
  })

  it('skips ingredients whose food no longer exists', () => {
    const totals = recipeTotals(
      [
        { foodId: 'f1', grams: 100 },
        { foodId: 'deleted', grams: 500 },
      ],
      foods,
    )
    expect(totals).toEqual(chicken.per100g)
  })

  it('divides totals across servings', () => {
    const totals: Nutrients = { kcal: 800, fat: 40, satFat: 12, carbs: 80, fibre: 0, protein: 60, salt: 4 }
    expect(perServing(totals, 4)).toEqual({
      kcal: 200,
      fat: 10,
      satFat: 3,
      carbs: 20,
      fibre: 0,
      protein: 15,
      salt: 1,
    })
  })

  it('returns zeros rather than Infinity for a zero or negative yield', () => {
    const totals: Nutrients = { kcal: 800, fat: 40, satFat: 12, carbs: 80, fibre: 0, protein: 60, salt: 4 }
    expect(perServing(totals, 0)).toEqual(ZERO_NUTRIENTS)
    expect(perServing(totals, -2)).toEqual(ZERO_NUTRIENTS)
  })

  it('computes per-serving nutrition for a recipe end to end', () => {
    const result = roundNutrients(
      recipePerServing(
        { ingredients: [{ foodId: 'f1', grams: 400 }], servings: 4 },
        foods,
      ),
    )
    expect(result).toEqual({ kcal: 165, fat: 3.6, satFat: 1, carbs: 0, fibre: 0, protein: 31, salt: 0.1 })
  })
})

describe('percentOfGoal', () => {
  it('returns the whole-number percentage consumed', () => {
    expect(percentOfGoal(500, 2000)).toBe(25)
    expect(percentOfGoal(2000, 2000)).toBe(100)
  })

  it('is uncapped so going over goal stays visible', () => {
    expect(percentOfGoal(3000, 2000)).toBe(150)
  })

  it('returns 0 for a zero, negative or non-finite target', () => {
    expect(percentOfGoal(500, 0)).toBe(0)
    expect(percentOfGoal(500, -10)).toBe(0)
    expect(percentOfGoal(500, Number.NaN)).toBe(0)
  })
})

describe('kcalFromMacros', () => {
  it('applies Atwater factors', () => {
    expect(kcalFromMacros({ fat: 10, carbs: 20, protein: 30 })).toBe(290)
  })
})
