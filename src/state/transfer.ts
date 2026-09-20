import { isValidDateKey } from '../domain/date'
import { MEAL_TYPES, NUTRIENT_KEYS } from '../domain/types'
import type { Food, Goals, LogByDate, LogEntry, Nutrients, Recipe } from '../domain/types'
import { DEFAULT_GOALS, DEFAULT_META, SCHEMA_VERSION } from '../storage/repository'
import { EMPTY_STATE, type AppState } from './reducer'

/**
 * Export / import is the only backup that exists when everything lives in
 * localStorage, so the import path validates hard: anything malformed is
 * dropped rather than allowed to corrupt the store.
 */

export interface BackupFile {
  app: 'health-app'
  schemaVersion: number
  exportedAt: string
  state: AppState
}

export function buildBackup(state: AppState): BackupFile {
  return {
    app: 'health-app',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }
}

export function backupFilename(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `health-app-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function parseNutrients(value: unknown): Nutrients | null {
  if (!isObject(value)) return null
  const out = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    if (!isPositiveNumber(value[key])) return null
    out[key] = value[key]
  }
  return out
}

function parseFood(value: unknown): Food | null {
  if (!isObject(value)) return null
  const { id, name, per100g } = value
  if (typeof id !== 'string' || typeof name !== 'string') return null
  const nutrients = parseNutrients(per100g)
  if (!nutrients) return null

  const food: Food = {
    id,
    name,
    per100g: nutrients,
    source: value.source === 'seed' ? 'seed' : 'user',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  }
  if (typeof value.brand === 'string') food.brand = value.brand
  if (typeof value.category === 'string') food.category = value.category
  if (
    isObject(value.defaultServing) &&
    typeof value.defaultServing.label === 'string' &&
    isPositiveNumber(value.defaultServing.grams)
  ) {
    food.defaultServing = {
      label: value.defaultServing.label,
      grams: value.defaultServing.grams,
    }
  }
  return food
}

function parseRecipe(value: unknown): Recipe | null {
  if (!isObject(value)) return null
  const { id, name, ingredients, servings } = value
  if (typeof id !== 'string' || typeof name !== 'string') return null
  if (!Array.isArray(ingredients) || !isPositiveNumber(servings) || servings < 1) return null

  const parsed = ingredients.flatMap((ingredient) =>
    isObject(ingredient) &&
    typeof ingredient.foodId === 'string' &&
    isPositiveNumber(ingredient.grams)
      ? [{ foodId: ingredient.foodId, grams: ingredient.grams }]
      : [],
  )

  return {
    id,
    name,
    servings,
    ingredients: parsed,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  }
}

function parseEntry(value: unknown, date: string): LogEntry | null {
  if (!isObject(value)) return null
  const { id, meal, ref, label } = value
  if (typeof id !== 'string' || typeof label !== 'string') return null
  if (typeof meal !== 'string' || !MEAL_TYPES.includes(meal as LogEntry['meal'])) return null

  const nutrients = parseNutrients(value.nutrients)
  if (!nutrients) return null
  if (!isObject(ref)) return null

  let parsedRef: LogEntry['ref']
  if (ref.kind === 'food' && typeof ref.id === 'string' && isPositiveNumber(ref.grams)) {
    parsedRef = { kind: 'food', id: ref.id, grams: ref.grams }
  } else if (ref.kind === 'recipe' && typeof ref.id === 'string' && isPositiveNumber(ref.servings)) {
    parsedRef = { kind: 'recipe', id: ref.id, servings: ref.servings }
  } else {
    return null
  }

  return {
    id,
    date,
    meal: meal as LogEntry['meal'],
    ref: parsedRef,
    label,
    nutrients,
    loggedAt: typeof value.loggedAt === 'string' ? value.loggedAt : new Date().toISOString(),
  }
}

function parseGoals(value: unknown): Goals {
  return parseNutrients(value) ?? DEFAULT_GOALS
}

function parseLog(value: unknown): LogByDate {
  if (!isObject(value)) return {}
  const log: LogByDate = {}
  for (const [date, entries] of Object.entries(value)) {
    if (!isValidDateKey(date) || !Array.isArray(entries)) continue
    const parsed = entries.flatMap((entry) => {
      const result = parseEntry(entry, date)
      return result ? [result] : []
    })
    if (parsed.length > 0) log[date] = parsed
  }
  return log
}

export class ImportError extends Error {}

/** Parse a backup file's text into state, throwing ImportError on anything unusable. */
export function parseBackup(text: string): AppState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError('That file is not valid JSON.')
  }

  if (!isObject(parsed) || parsed.app !== 'health-app') {
    throw new ImportError('That does not look like a Health App backup.')
  }
  if (!isObject(parsed.state)) {
    throw new ImportError('The backup file is missing its data.')
  }

  const source = parsed.state
  const foods = Array.isArray(source.foods)
    ? source.foods.flatMap((food) => {
        const result = parseFood(food)
        return result ? [result] : []
      })
    : []
  const recipes = Array.isArray(source.recipes)
    ? source.recipes.flatMap((recipe) => {
        const result = parseRecipe(recipe)
        return result ? [result] : []
      })
    : []

  const meta = isObject(source.meta) && isPositiveNumber(source.meta.seedVersion)
    ? { seedVersion: source.meta.seedVersion }
    : DEFAULT_META

  return {
    ...EMPTY_STATE,
    foods,
    recipes,
    log: parseLog(source.log),
    goals: parseGoals(source.goals),
    meta,
  }
}
