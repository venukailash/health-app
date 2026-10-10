import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, type DateKey } from '../domain/date'
import { roundNutrients } from '../domain/nutrition'
import { MEAL_LABELS, MEAL_TYPES, type Goals, type Nutrients } from '../domain/types'
import type { InsightScope } from '../domain/insights'
import type { AppState } from './reducer'
import { dayTotals, entriesForDate, mealTotals, rangeStats } from './selectors'

/**
 * The crunched summary that gets sent to Gemini — never the raw log.
 *
 * Totals, averages and per-day figures are all the model needs to say
 * something useful, and they are a fraction of the size. Nothing identifying
 * goes with it: no food names on the week and month views, no device details,
 * no key beyond the one in the request.
 */

export interface InsightInput {
  scope: InsightScope
  periodKey: DateKey
  from: DateKey
  to: DateKey
  goals: Goals
  /** Day scope: what each meal contributed. */
  meals?: { meal: string; nutrients: Nutrients; entries: string[] }[]
  totals: Nutrients
  /** Week and month scope only. */
  averagePerLoggedDay?: Nutrients
  loggedDays?: number
  totalDays?: number
  daysOnTarget?: number
  days?: { date: DateKey; logged: boolean; kcal: number }[]
}

export function periodRange(scope: InsightScope, date: DateKey): { from: DateKey; to: DateKey } {
  if (scope === 'week') return { from: startOfWeek(date), to: endOfWeek(date) }
  if (scope === 'month') return { from: startOfMonth(date), to: endOfMonth(date) }
  return { from: date, to: date }
}

/** The date an insight is filed under: the day, or the start of the period. */
export function periodKeyFor(scope: InsightScope, date: DateKey): DateKey {
  return periodRange(scope, date).from
}

export function buildInsightInput(
  state: AppState,
  scope: InsightScope,
  date: DateKey,
): InsightInput {
  const { from, to } = periodRange(scope, date)

  if (scope === 'day') {
    const byMeal = mealTotals(state, date)
    return {
      scope,
      periodKey: from,
      from,
      to,
      goals: state.goals,
      totals: roundNutrients(dayTotals(state, date)),
      meals: MEAL_TYPES.map((meal) => ({
        meal: MEAL_LABELS[meal],
        nutrients: roundNutrients(byMeal[meal]),
        entries: entriesForDate(state, date)
          .filter((entry) => entry.meal === meal)
          .map((entry) => entry.label),
      })),
    }
  }

  const stats = rangeStats(state, from, to)
  return {
    scope,
    periodKey: from,
    from,
    to,
    goals: state.goals,
    totals: roundNutrients(stats.totals),
    averagePerLoggedDay: roundNutrients(stats.averages),
    loggedDays: stats.loggedDays,
    totalDays: stats.totalDays,
    daysOnTarget: stats.daysOnTarget,
    // Calories per day only: the shape of the period is what matters here,
    // and seven full nutrient blocks is a lot of tokens for little more.
    days: stats.days.map((day) => ({
      date: day.date,
      logged: day.logged,
      kcal: Math.round(day.totals.kcal),
    })),
  }
}

/**
 * Whether there is enough logged to be worth asking about.
 *
 * A day needs breakfast, lunch and dinner — a reading of a day with only
 * breakfast in it would just say "you have not eaten much today". A week or
 * month needs one logged day, and gaps are fine: an honest look at four days
 * out of thirty is still worth having, and the model is told how many are
 * missing.
 */
export function hasEnoughToRead(state: AppState, scope: InsightScope, date: DateKey): boolean {
  if (scope === 'day') {
    const byMeal = mealTotals(state, date)
    const entries = entriesForDate(state, date)
    return (['breakfast', 'lunch', 'dinner'] as const).every(
      (meal) => entries.some((entry) => entry.meal === meal) && byMeal[meal].kcal >= 0,
    )
  }

  const { from, to } = periodRange(scope, date)
  return rangeStats(state, from, to).loggedDays > 0
}
