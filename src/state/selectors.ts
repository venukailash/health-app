import { multiplyNutrients, percentOfGoal, sumNutrients, unsaturatedFat } from '../domain/nutrition'
import { dateRange, type DateKey } from '../domain/date'
import type { Food, Goals, LogEntry, MealType, NutrientKey, Nutrients } from '../domain/types'
import { MEAL_TYPES, NUTRIENT_KEYS } from '../domain/types'
import type { AppState } from './reducer'

export function foodsById(foods: Food[]): Map<string, Food> {
  return new Map(foods.map((food) => [food.id, food]))
}

export function entriesForDate(state: AppState, date: DateKey): LogEntry[] {
  return state.log[date] ?? []
}

export function entriesForMeal(state: AppState, date: DateKey, meal: MealType): LogEntry[] {
  return entriesForDate(state, date).filter((entry) => entry.meal === meal)
}

export function totalsFor(entries: LogEntry[]): Nutrients {
  return sumNutrients(entries.map((entry) => entry.nutrients))
}

export function dayTotals(state: AppState, date: DateKey): Nutrients {
  return totalsFor(entriesForDate(state, date))
}

export function mealTotals(state: AppState, date: DateKey): Record<MealType, Nutrients> {
  const entries = entriesForDate(state, date)
  return Object.fromEntries(
    MEAL_TYPES.map((meal) => [meal, totalsFor(entries.filter((entry) => entry.meal === meal))]),
  ) as Record<MealType, Nutrients>
}

export interface Progress {
  key: NutrientKey
  consumed: number
  target: number
  /** Uncapped: 120 means 20% over goal. */
  percent: number
  /** Negative once the target is exceeded. */
  remaining: number
  over: boolean
}

export function goalProgress(totals: Nutrients, goals: Goals): Record<NutrientKey, Progress> {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => {
      const consumed = totals[key] ?? 0
      const target = goals[key] ?? 0
      return [
        key,
        {
          key,
          consumed,
          target,
          percent: percentOfGoal(consumed, target),
          remaining: target - consumed,
          over: target > 0 && consumed > target,
        } satisfies Progress,
      ]
    }),
  ) as Record<NutrientKey, Progress>
}

/** Saturated / unsaturated split for the fat breakdown on the dashboard. */
export function fatBreakdown(totals: Nutrients): {
  total: number
  saturated: number
  unsaturated: number
  saturatedShare: number
} {
  const total = totals.fat ?? 0
  const saturated = Math.min(totals.satFat ?? 0, total)
  return {
    total,
    saturated,
    unsaturated: unsaturatedFat(totals),
    saturatedShare: total > 0 ? Math.round((saturated / total) * 100) : 0,
  }
}

/** Days that have at least one logged entry, most recent first. */
export function loggedDates(state: AppState): DateKey[] {
  return Object.keys(state.log)
    .filter((date) => (state.log[date]?.length ?? 0) > 0)
    .sort()
    .reverse()
}

/* ------------------------------------------------------------------ */
/* Ranges — the weekly and monthly views                                */
/* ------------------------------------------------------------------ */

export interface DaySummary {
  date: DateKey
  totals: Nutrients
  /** False for a day with nothing logged, which is not the same as a 0 kcal day. */
  logged: boolean
  entryCount: number
}

/** One summary per day across an inclusive range, including blank days. */
export function daySummaries(state: AppState, from: DateKey, to: DateKey): DaySummary[] {
  return dateRange(from, to).map((date) => {
    const entries = entriesForDate(state, date)
    return {
      date,
      totals: totalsFor(entries),
      logged: entries.length > 0,
      entryCount: entries.length,
    }
  })
}

export function rangeTotals(state: AppState, from: DateKey, to: DateKey): Nutrients {
  return sumNutrients(daySummaries(state, from, to).map((day) => day.totals))
}

export interface RangeStats {
  from: DateKey
  to: DateKey
  days: DaySummary[]
  /** Days in the range that have at least one entry. */
  loggedDays: number
  totalDays: number
  totals: Nutrients
  /**
   * Mean per LOGGED day, not per calendar day. Averaging over blank days
   * would quietly report someone as eating 900 kcal because they only
   * tracked four days out of seven.
   */
  averages: Nutrients
  /** Logged days whose calories landed at or under the goal. */
  daysOnTarget: number
  bestStreak: number
}

export function rangeStats(state: AppState, from: DateKey, to: DateKey): RangeStats {
  const days = daySummaries(state, from, to)
  const logged = days.filter((day) => day.logged)
  const totals = sumNutrients(days.map((day) => day.totals))
  const divisor = logged.length || 1
  const goal = state.goals.kcal

  let streak = 0
  let bestStreak = 0
  for (const day of days) {
    if (day.logged) {
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
    } else {
      streak = 0
    }
  }

  return {
    from,
    to,
    days,
    loggedDays: logged.length,
    totalDays: days.length,
    totals,
    averages: multiplyNutrients(totals, 1 / divisor),
    daysOnTarget: goal > 0 ? logged.filter((day) => day.totals.kcal <= goal).length : 0,
    bestStreak,
  }
}
