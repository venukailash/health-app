import { describe, expect, it } from 'vitest'
import { EMPTY_STATE, type AppState } from './reducer'
import { createFood, logFood } from './factories'
import {
  dayTotals,
  entriesForDate,
  entriesForMeal,
  fatBreakdown,
  foodsById,
  goalProgress,
  loggedDates,
  mealTotals,
} from './selectors'
import { DEFAULT_GOALS } from '../storage/repository'
import { roundNutrients } from '../domain/nutrition'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, protein: 11, salt: 0.02 },
})
const chicken = createFood({
  name: 'Chicken breast',
  per100g: { kcal: 165, fat: 3.6, satFat: 1, carbs: 0, protein: 31, salt: 0.1 },
})

const state: AppState = {
  ...EMPTY_STATE,
  foods: [oats, chicken],
  log: {
    '2026-09-20': [
      logFood(oats, 100, 'breakfast', '2026-09-20'),
      logFood(chicken, 200, 'lunch', '2026-09-20'),
    ],
    '2026-09-19': [logFood(oats, 50, 'breakfast', '2026-09-19')],
  },
}

describe('foodsById', () => {
  it('indexes foods for O(1) lookup', () => {
    const index = foodsById(state.foods)
    expect(index.get(oats.id)?.name).toBe('Porridge oats')
    expect(index.get('missing')).toBeUndefined()
  })
})

describe('entry selection', () => {
  it('returns only the requested day', () => {
    expect(entriesForDate(state, '2026-09-20')).toHaveLength(2)
    expect(entriesForDate(state, '2026-09-19')).toHaveLength(1)
  })

  it('returns an empty list for a day with nothing logged', () => {
    expect(entriesForDate(state, '2026-01-01')).toEqual([])
  })

  it('filters by meal', () => {
    expect(entriesForMeal(state, '2026-09-20', 'breakfast')).toHaveLength(1)
    expect(entriesForMeal(state, '2026-09-20', 'dinner')).toEqual([])
  })
})

describe('totals', () => {
  it('sums the selected day only', () => {
    expect(roundNutrients(dayTotals(state, '2026-09-20'))).toEqual({
      kcal: 709,
      fat: 15.2,
      satFat: 3.4,
      carbs: 60,
      protein: 73,
      salt: 0.22,
    })
  })

  it('returns zeros for an empty day', () => {
    expect(dayTotals(state, '2026-01-01')).toEqual({
      kcal: 0,
      fat: 0,
      satFat: 0,
      carbs: 0,
      protein: 0,
      salt: 0,
    })
  })

  it('breaks totals down per meal', () => {
    const byMeal = mealTotals(state, '2026-09-20')
    expect(Math.round(byMeal.breakfast.kcal)).toBe(379)
    expect(Math.round(byMeal.lunch.kcal)).toBe(330)
    expect(byMeal.dinner.kcal).toBe(0)
    expect(byMeal.snack.kcal).toBe(0)
  })
})

describe('goalProgress', () => {
  it('reports consumed, target, percent and remaining per nutrient', () => {
    const progress = goalProgress(dayTotals(state, '2026-09-20'), DEFAULT_GOALS)
    expect(progress.kcal.percent).toBe(35)
    expect(Math.round(progress.kcal.remaining)).toBe(1291)
    expect(progress.kcal.over).toBe(false)
  })

  it('flags nutrients over target without capping the percentage', () => {
    const progress = goalProgress(
      { kcal: 2500, fat: 90, satFat: 30, carbs: 300, protein: 60, salt: 9 },
      DEFAULT_GOALS,
    )
    expect(progress.kcal.over).toBe(true)
    expect(progress.kcal.percent).toBe(125)
    expect(progress.salt.percent).toBe(150)
    expect(progress.satFat.remaining).toBe(-10)
  })

  it('handles a zero target without dividing by zero', () => {
    const progress = goalProgress(
      { kcal: 500, fat: 0, satFat: 0, carbs: 0, protein: 0, salt: 0 },
      { ...DEFAULT_GOALS, kcal: 0 },
    )
    expect(progress.kcal.percent).toBe(0)
    expect(progress.kcal.over).toBe(false)
  })
})

describe('fatBreakdown', () => {
  it('splits total fat into saturated and derived unsaturated', () => {
    const result = fatBreakdown({ kcal: 0, fat: 20, satFat: 5, carbs: 0, protein: 0, salt: 0 })
    expect(result).toEqual({ total: 20, saturated: 5, unsaturated: 15, saturatedShare: 25 })
  })

  it('never reports more saturated than total, or a NaN share', () => {
    const odd = fatBreakdown({ kcal: 0, fat: 2, satFat: 5, carbs: 0, protein: 0, salt: 0 })
    expect(odd.saturated).toBe(2)
    expect(odd.unsaturated).toBe(0)

    const none = fatBreakdown({ kcal: 0, fat: 0, satFat: 0, carbs: 0, protein: 0, salt: 0 })
    expect(none.saturatedShare).toBe(0)
  })
})

describe('loggedDates', () => {
  it('lists days with entries, most recent first', () => {
    expect(loggedDates(state)).toEqual(['2026-09-20', '2026-09-19'])
  })

  it('skips empty buckets', () => {
    expect(loggedDates({ ...EMPTY_STATE, log: { '2026-09-20': [] } })).toEqual([])
  })
})
