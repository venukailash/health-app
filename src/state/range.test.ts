import { describe, expect, it } from 'vitest'
import { EMPTY_STATE, type AppState } from './reducer'
import { createFood, logFood } from './factories'
import { daySummaries, rangeStats, rangeTotals } from './selectors'
import { DEFAULT_GOALS } from '../storage/repository'
import { roundNutrients } from '../domain/nutrition'

const food = createFood({
  name: 'Test food',
  // Exactly 100 kcal per 100 g keeps the arithmetic obvious.
  per100g: { kcal: 100, fat: 10, satFat: 4, carbs: 20, protein: 5, salt: 1 },
})

/** A day logging `kcal` calories, via `kcal` grams of the 100 kcal/100 g food. */
const day = (date: string, kcal: number) => logFood(food, kcal, 'breakfast', date)

const stateWith = (log: AppState['log'], goals = DEFAULT_GOALS): AppState => ({
  ...EMPTY_STATE,
  foods: [food],
  goals,
  log,
})

describe('daySummaries', () => {
  it('returns one entry per calendar day, including blanks', () => {
    const state = stateWith({ '2026-09-15': [day('2026-09-15', 500)] })
    const summaries = daySummaries(state, '2026-09-14', '2026-09-20')

    expect(summaries).toHaveLength(7)
    expect(summaries.map((summary) => summary.date)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })

  it('distinguishes a blank day from a logged one', () => {
    const state = stateWith({ '2026-09-15': [day('2026-09-15', 500)] })
    const [blank, logged] = daySummaries(state, '2026-09-14', '2026-09-15')

    expect(blank.logged).toBe(false)
    expect(blank.entryCount).toBe(0)
    expect(blank.totals.kcal).toBe(0)

    expect(logged.logged).toBe(true)
    expect(logged.entryCount).toBe(1)
    expect(Math.round(logged.totals.kcal)).toBe(500)
  })

  it('sums several entries within a day', () => {
    const state = stateWith({
      '2026-09-15': [day('2026-09-15', 300), day('2026-09-15', 400)],
    })
    expect(Math.round(daySummaries(state, '2026-09-15', '2026-09-15')[0].totals.kcal)).toBe(700)
  })
})

describe('rangeTotals', () => {
  it('adds up every day in the range', () => {
    const state = stateWith({
      '2026-09-14': [day('2026-09-14', 1000)],
      '2026-09-16': [day('2026-09-16', 500)],
    })
    expect(Math.round(rangeTotals(state, '2026-09-14', '2026-09-20').kcal)).toBe(1500)
  })

  it('ignores days outside the range', () => {
    const state = stateWith({
      '2026-09-13': [day('2026-09-13', 9999)],
      '2026-09-14': [day('2026-09-14', 1000)],
      '2026-09-21': [day('2026-09-21', 9999)],
    })
    expect(Math.round(rangeTotals(state, '2026-09-14', '2026-09-20').kcal)).toBe(1000)
  })

  it('is zero across an empty range', () => {
    expect(rangeTotals(stateWith({}), '2026-09-14', '2026-09-20').kcal).toBe(0)
  })
})

describe('rangeStats averages', () => {
  it('averages over logged days, not calendar days', () => {
    // 2 days logged at 2000 and 1000 out of a 7-day week.
    const state = stateWith({
      '2026-09-14': [day('2026-09-14', 2000)],
      '2026-09-15': [day('2026-09-15', 1000)],
    })
    const stats = rangeStats(state, '2026-09-14', '2026-09-20')

    expect(stats.loggedDays).toBe(2)
    expect(stats.totalDays).toBe(7)
    // 3000 / 2 logged days = 1500. Dividing by 7 would report a misleading 429.
    expect(Math.round(stats.averages.kcal)).toBe(1500)
  })

  it('averages every macro, not just calories', () => {
    const state = stateWith({
      '2026-09-14': [day('2026-09-14', 200)],
      '2026-09-15': [day('2026-09-15', 100)],
    })
    const averages = roundNutrients(rangeStats(state, '2026-09-14', '2026-09-20').averages)
    // 300 g of food across 2 days = 150 g/day → 15 g fat, 30 g carbs.
    expect(averages).toEqual({
      kcal: 150,
      fat: 15,
      satFat: 6,
      carbs: 30,
      protein: 7.5,
      salt: 1.5,
    })
  })

  it('reports zero averages rather than dividing by zero on an empty range', () => {
    const stats = rangeStats(stateWith({}), '2026-09-14', '2026-09-20')
    expect(stats.loggedDays).toBe(0)
    expect(stats.averages.kcal).toBe(0)
    expect(Number.isFinite(stats.averages.kcal)).toBe(true)
  })
})

describe('rangeStats daysOnTarget', () => {
  it('counts logged days at or under the calorie goal', () => {
    const state = stateWith({
      '2026-09-14': [day('2026-09-14', 1800)],
      '2026-09-15': [day('2026-09-15', 2000)], // exactly on goal counts
      '2026-09-16': [day('2026-09-16', 2200)],
    })
    expect(rangeStats(state, '2026-09-14', '2026-09-20').daysOnTarget).toBe(2)
  })

  it('does not count blank days as on target', () => {
    const state = stateWith({ '2026-09-14': [day('2026-09-14', 1800)] })
    const stats = rangeStats(state, '2026-09-14', '2026-09-20')
    expect(stats.daysOnTarget).toBe(1)
    expect(stats.loggedDays).toBe(1)
  })

  it('reports zero when no calorie goal is set', () => {
    const state = stateWith(
      { '2026-09-14': [day('2026-09-14', 1800)] },
      { ...DEFAULT_GOALS, kcal: 0 },
    )
    expect(rangeStats(state, '2026-09-14', '2026-09-20').daysOnTarget).toBe(0)
  })
})

describe('rangeStats bestStreak', () => {
  it('finds the longest run of consecutive logged days', () => {
    const state = stateWith({
      '2026-09-14': [day('2026-09-14', 100)],
      '2026-09-15': [day('2026-09-15', 100)],
      '2026-09-17': [day('2026-09-17', 100)],
      '2026-09-18': [day('2026-09-18', 100)],
      '2026-09-19': [day('2026-09-19', 100)],
    })
    expect(rangeStats(state, '2026-09-14', '2026-09-20').bestStreak).toBe(3)
  })

  it('is zero for an empty range and the full length when every day is logged', () => {
    expect(rangeStats(stateWith({}), '2026-09-14', '2026-09-20').bestStreak).toBe(0)

    const full = Object.fromEntries(
      ['14', '15', '16', '17', '18', '19', '20'].map((d) => [
        `2026-09-${d}`,
        [day(`2026-09-${d}`, 100)],
      ]),
    )
    expect(rangeStats(stateWith(full), '2026-09-14', '2026-09-20').bestStreak).toBe(7)
  })
})
