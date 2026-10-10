import { describe, expect, it } from 'vitest'
import { buildInsightInput, hasEnoughToRead, periodKeyFor, periodRange } from './insightInput'
import { EMPTY_STATE, type AppState } from './reducer'
import { createFood, logFood } from './factories'
import { DEFAULT_GOALS } from '../storage/repository'
import type { MealType } from '../domain/types'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 5, protein: 11, salt: 0.02 },
})

const withMeals = (date: string, meals: MealType[]): AppState => ({
  ...EMPTY_STATE,
  goals: DEFAULT_GOALS,
  foods: [oats],
  log: { [date]: meals.map((meal) => logFood(oats, 100, meal, date)) },
})

describe('periodRange', () => {
  it('covers the day, the Monday-to-Sunday week, or the calendar month', () => {
    expect(periodRange('day', '2026-10-07')).toEqual({ from: '2026-10-07', to: '2026-10-07' })
    expect(periodRange('week', '2026-10-07')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(periodRange('month', '2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('files every day of a period under the same key, so one reading covers it', () => {
    expect(periodKeyFor('week', '2026-10-05')).toBe(periodKeyFor('week', '2026-10-11'))
    expect(periodKeyFor('month', '2026-10-01')).toBe(periodKeyFor('month', '2026-10-31'))
  })
})

describe('hasEnoughToRead', () => {
  it('needs breakfast, lunch and dinner before reading a day', () => {
    expect(hasEnoughToRead(withMeals('2026-10-07', ['breakfast']), 'day', '2026-10-07')).toBe(false)
    expect(
      hasEnoughToRead(withMeals('2026-10-07', ['breakfast', 'lunch']), 'day', '2026-10-07'),
    ).toBe(false)
    expect(
      hasEnoughToRead(withMeals('2026-10-07', ['breakfast', 'lunch', 'dinner']), 'day', '2026-10-07'),
    ).toBe(true)
  })

  it('does not require a snack', () => {
    const state = withMeals('2026-10-07', ['breakfast', 'lunch', 'dinner'])
    expect(hasEnoughToRead(state, 'day', '2026-10-07')).toBe(true)
  })

  it('reads a week or month off a single logged day, gaps and all', () => {
    const state = withMeals('2026-10-07', ['lunch'])
    expect(hasEnoughToRead(state, 'week', '2026-10-07')).toBe(true)
    expect(hasEnoughToRead(state, 'month', '2026-10-07')).toBe(true)
  })

  it('has nothing to say about a period with nothing in it', () => {
    expect(hasEnoughToRead(EMPTY_STATE, 'week', '2026-10-07')).toBe(false)
    expect(hasEnoughToRead(EMPTY_STATE, 'month', '2026-10-07')).toBe(false)
    expect(hasEnoughToRead(EMPTY_STATE, 'day', '2026-10-07')).toBe(false)
  })
})

describe('buildInsightInput', () => {
  it('breaks a day down by meal, with what was in each', () => {
    const input = buildInsightInput(
      withMeals('2026-10-07', ['breakfast', 'lunch', 'dinner']),
      'day',
      '2026-10-07',
    )

    expect(input.scope).toBe('day')
    expect(input.totals.kcal).toBe(1137)
    expect(input.meals?.map((meal) => meal.meal)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snacks',
    ])
    expect(input.meals?.[0].entries).toEqual(['Porridge oats'])
    expect(input.days).toBeUndefined()
  })

  it('sends a week as per-day calories plus averages over LOGGED days only', () => {
    const state: AppState = {
      ...EMPTY_STATE,
      goals: DEFAULT_GOALS,
      foods: [oats],
      log: {
        '2026-10-05': [logFood(oats, 100, 'breakfast', '2026-10-05')],
        '2026-10-07': [logFood(oats, 200, 'lunch', '2026-10-07')],
      },
    }

    const input = buildInsightInput(state, 'week', '2026-10-07')

    expect(input.from).toBe('2026-10-05')
    expect(input.to).toBe('2026-10-11')
    expect(input.loggedDays).toBe(2)
    expect(input.totalDays).toBe(7)
    expect(input.days).toHaveLength(7)
    // A blank day is marked unlogged, not sent as a zero-calorie day.
    expect(input.days?.filter((day) => day.logged).map((day) => day.date)).toEqual([
      '2026-10-05',
      '2026-10-07',
    ])
    // 379 + 758 over two logged days, not over seven.
    expect(input.averagePerLoggedDay?.kcal).toBe(569)
    expect(input.meals).toBeUndefined()
  })

  it('carries the targets, since the whole point is measuring against them', () => {
    const input = buildInsightInput(withMeals('2026-10-07', ['lunch']), 'month', '2026-10-07')
    expect(input.goals).toEqual(DEFAULT_GOALS)
  })
})

describe('what a week sends about recurring foods', () => {
  const coffee = createFood({
    name: 'Flat white',
    per100g: { kcal: 60, fat: 3, satFat: 2, carbs: 5, fibre: 0, protein: 3, salt: 0.1 },
  })

  it('names what keeps turning up, biggest contributor first', () => {
    const state: AppState = {
      ...EMPTY_STATE,
      goals: DEFAULT_GOALS,
      foods: [oats, coffee],
      log: {
        '2026-10-05': [logFood(oats, 100, 'breakfast', '2026-10-05'), logFood(coffee, 200, 'snack', '2026-10-05')],
        '2026-10-06': [logFood(coffee, 200, 'snack', '2026-10-06')],
        '2026-10-07': [logFood(coffee, 200, 'snack', '2026-10-07')],
        '2026-10-08': [logFood(coffee, 200, 'snack', '2026-10-08')],
      },
    }

    const input = buildInsightInput(state, 'week', '2026-10-07')

    expect(input.frequentFoods).toEqual([
      // A small habit four times over outweighs one big bowl, which is the
      // kind of thing the reading exists to point out.
      { name: 'Flat white', times: 4, kcal: 480 },
      { name: 'Porridge oats', times: 1, kcal: 379 },
    ])
  })

  it('sends none of this for a single day, where the meals already carry it', () => {
    const input = buildInsightInput(withMeals('2026-10-07', ['lunch']), 'day', '2026-10-07')
    expect(input.frequentFoods).toBeUndefined()
    expect(input.meals?.flatMap((meal) => meal.entries)).toContain('Porridge oats')
  })
})
