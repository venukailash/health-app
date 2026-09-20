import type { Food, Nutrients, Serving } from '../../domain/types'
import seedData from './foods.seed.json'

interface SeedFood {
  id: string
  name: string
  category: string
  per100g: Nutrients
  defaultServing?: Serving
}

interface SeedFile {
  seedVersion: number
  foods: SeedFood[]
}

const file = seedData as SeedFile

/** Bump in foods.seed.json when starter foods are added, to top up existing users. */
export const SEED_VERSION = file.seedVersion

const SEED_CREATED_AT = '2026-01-01T00:00:00.000Z'

export const seedFoods: Food[] = file.foods.map((entry) => ({
  ...entry,
  source: 'seed' as const,
  createdAt: SEED_CREATED_AT,
}))

/**
 * Starter foods the user does not already have. Matching on id means a food
 * the user deleted stays deleted, and a re-seed only ever adds what is new.
 */
export function missingSeedFoods(existing: Food[]): Food[] {
  const known = new Set(existing.map((food) => food.id))
  return seedFoods.filter((food) => !known.has(food.id))
}

/**
 * Apply the current starter data to a library: refresh the foods that came
 * from a previous seed revision and append any new ones.
 *
 * Starter foods are read-only, so replacing them is safe and is the only way
 * an existing install picks up corrections — when fibre was added, every
 * already-seeded food would otherwise have been stuck reporting zero.
 * User-created foods are never touched, and a starter food the user deleted
 * stays deleted.
 */
export function applySeedFoods(existing: Food[]): Food[] {
  const current = new Map(seedFoods.map((food) => [food.id, food]))
  const refreshed = existing.map((food) =>
    food.source === 'seed' && current.has(food.id) ? (current.get(food.id) as Food) : food,
  )
  return [...refreshed, ...missingSeedFoods(existing)]
}
