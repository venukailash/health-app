import type { Food, Goals, LogByDate, LogEntry, Recipe } from '../domain/types'
import { DEFAULT_GOALS, DEFAULT_META, type Meta } from '../storage/repository'
import { applySeedFoods } from '../storage/seed'

export interface AppState {
  foods: Food[]
  recipes: Recipe[]
  log: LogByDate
  goals: Goals
  meta: Meta
}

export const EMPTY_STATE: AppState = {
  foods: [],
  recipes: [],
  log: {},
  goals: DEFAULT_GOALS,
  meta: DEFAULT_META,
}

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'goals/set'; goals: Goals }
  | { type: 'food/add'; food: Food }
  | { type: 'food/update'; food: Food }
  | { type: 'food/delete'; id: string }
  | { type: 'recipe/add'; recipe: Recipe }
  | { type: 'recipe/update'; recipe: Recipe }
  | { type: 'recipe/delete'; id: string }
  | { type: 'entry/add'; entry: LogEntry }
  | { type: 'entry/update'; entry: LogEntry }
  | { type: 'entry/delete'; date: string; id: string }
  | { type: 'meta/set'; meta: Meta }
  | { type: 'seed/apply'; seedVersion: number }
  | { type: 'data/replace'; state: AppState }
  | { type: 'data/clear' }

/** Remove an entry id from a date bucket, dropping the bucket when it empties. */
function withoutEntry(log: LogByDate, date: string, id: string): LogByDate {
  const bucket = log[date]
  if (!bucket) return log
  const remaining = bucket.filter((entry) => entry.id !== id)
  if (remaining.length === bucket.length) return log
  const next = { ...log }
  if (remaining.length === 0) delete next[date]
  else next[date] = remaining
  return next
}

function withEntry(log: LogByDate, entry: LogEntry): LogByDate {
  const bucket = log[entry.date] ?? []
  return { ...log, [entry.date]: [...bucket, entry] }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
    case 'data/replace':
      return action.state

    case 'goals/set':
      return { ...state, goals: action.goals }

    case 'meta/set':
      return { ...state, meta: action.meta }

    case 'food/add':
      return { ...state, foods: [...state.foods, action.food] }

    case 'food/update':
      // Log entries hold a snapshot, so correcting a food deliberately leaves
      // everything already eaten untouched.
      return {
        ...state,
        foods: state.foods.map((food) => (food.id === action.food.id ? action.food : food)),
      }

    case 'food/delete':
      return { ...state, foods: state.foods.filter((food) => food.id !== action.id) }

    case 'recipe/add':
      return { ...state, recipes: [...state.recipes, action.recipe] }

    case 'recipe/update':
      return {
        ...state,
        recipes: state.recipes.map((recipe) =>
          recipe.id === action.recipe.id ? action.recipe : recipe,
        ),
      }

    case 'recipe/delete':
      return { ...state, recipes: state.recipes.filter((recipe) => recipe.id !== action.id) }

    case 'entry/add':
      return { ...state, log: withEntry(state.log, action.entry) }

    case 'entry/update': {
      // An edit can move an entry to another day, so drop it from every bucket
      // before re-inserting under its current date.
      const previousDate = Object.keys(state.log).find((date) =>
        state.log[date].some((entry) => entry.id === action.entry.id),
      )
      const pruned = previousDate ? withoutEntry(state.log, previousDate, action.entry.id) : state.log
      return { ...state, log: withEntry(pruned, action.entry) }
    }

    case 'entry/delete':
      return { ...state, log: withoutEntry(state.log, action.date, action.id) }

    case 'seed/apply':
      return {
        ...state,
        foods: applySeedFoods(state.foods),
        meta: { ...state.meta, seedVersion: action.seedVersion },
      }

    case 'data/clear':
      return { ...EMPTY_STATE, log: {}, foods: [], recipes: [] }

    default:
      return state
  }
}
