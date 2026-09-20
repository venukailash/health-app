import { sumNutrients } from '../domain/nutrition'
import { percentOfGoal, unsaturatedFat } from '../domain/nutrition'
import type { DateKey } from '../domain/date'
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
