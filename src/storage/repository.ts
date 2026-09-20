import type { Food, Goals, LogByDate, Recipe } from '../domain/types'

/**
 * The only module in the app that touches localStorage. Every record is
 * wrapped as { version, data } so a future schema change has a migration
 * hook, and every read degrades to the supplied fallback rather than
 * throwing — a corrupt key must never white-screen the app.
 */

export const SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
  foods: 'healthapp.foods.v1',
  recipes: 'healthapp.recipes.v1',
  log: 'healthapp.log.v1',
  goals: 'healthapp.goals.v1',
  meta: 'healthapp.meta.v1',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export interface Meta {
  /** Which revision of the bundled starter foods has been imported. */
  seedVersion: number
}

export interface Envelope<T> {
  version: number
  data: T
}

export const DEFAULT_GOALS: Goals = {
  kcal: 2000,
  fat: 70,
  satFat: 20,
  carbs: 260,
  protein: 50,
  salt: 6,
}

export const DEFAULT_META: Meta = { seedVersion: 0 }

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // Safari in private mode, or a sandboxed iframe, can throw on access.
    return null
  }
}

/** Raised when a write fails because the browser store is full or unavailable. */
export class StorageWriteError extends Error {
  readonly key: string
  override readonly cause: unknown

  constructor(key: string, cause: unknown) {
    super(`Could not save "${key}". Your browser storage may be full.`)
    this.name = 'StorageWriteError'
    this.key = key
    this.cause = cause
  }
}

function migrate<T>(envelope: Envelope<unknown>, fallback: T): T {
  // v1 is the first schema; nothing older exists to upgrade from. Anything
  // claiming a newer version was written by a later build of the app, so we
  // leave it untouched on disk and run with defaults in memory.
  if (envelope.version === SCHEMA_VERSION) return envelope.data as T
  return fallback
}

export function read<T>(key: StorageKey, fallback: T, validate?: (value: unknown) => boolean): T {
  const store = storage()
  if (!store) return fallback

  let raw: string | null
  try {
    raw = store.getItem(key)
  } catch {
    return fallback
  }
  if (raw === null) return fallback

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fallback
  }

  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || !('data' in parsed)) {
    return fallback
  }

  const envelope = parsed as Envelope<unknown>
  if (typeof envelope.version !== 'number') return fallback

  const data = migrate(envelope, fallback)
  if (validate && !validate(data)) return fallback
  return data
}

export function write<T>(key: StorageKey, data: T): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(key, JSON.stringify({ version: SCHEMA_VERSION, data } satisfies Envelope<T>))
  } catch (cause) {
    throw new StorageWriteError(key, cause)
  }
}

export function remove(key: StorageKey): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // Nothing useful to do — the key stays until the browser is cleared.
  }
}

const isArray = (value: unknown): boolean => Array.isArray(value)
const isRecord = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const repository = {
  loadFoods: (): Food[] => read<Food[]>(STORAGE_KEYS.foods, [], isArray),
  saveFoods: (foods: Food[]): void => write(STORAGE_KEYS.foods, foods),

  loadRecipes: (): Recipe[] => read<Recipe[]>(STORAGE_KEYS.recipes, [], isArray),
  saveRecipes: (recipes: Recipe[]): void => write(STORAGE_KEYS.recipes, recipes),

  loadLog: (): LogByDate => read<LogByDate>(STORAGE_KEYS.log, {}, isRecord),
  saveLog: (log: LogByDate): void => write(STORAGE_KEYS.log, log),

  loadGoals: (): Goals => read<Goals>(STORAGE_KEYS.goals, DEFAULT_GOALS, isRecord),
  saveGoals: (goals: Goals): void => write(STORAGE_KEYS.goals, goals),

  loadMeta: (): Meta => read<Meta>(STORAGE_KEYS.meta, DEFAULT_META, isRecord),
  saveMeta: (meta: Meta): void => write(STORAGE_KEYS.meta, meta),

  clearAll: (): void => {
    for (const key of Object.values(STORAGE_KEYS)) remove(key)
  },
}
