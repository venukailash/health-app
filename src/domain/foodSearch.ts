import type { Food } from './types'

/** Case-insensitive match across the fields a user would search by. */
export function matchesQuery(food: Food, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return [food.name, food.brand, food.category]
    .filter((field): field is string => typeof field === 'string')
    .some((field) => field.toLowerCase().includes(needle))
}

/** Bucket foods by category for the library list, alphabetically by heading. */
export function groupByCategory(foods: Food[]): [string, Food[]][] {
  const groups = new Map<string, Food[]>()
  for (const food of foods) {
    const key = food.category?.trim() || 'Other'
    const bucket = groups.get(key)
    if (bucket) bucket.push(food)
    else groups.set(key, [food])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}
