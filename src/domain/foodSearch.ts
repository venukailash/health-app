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
/**
 * Your own foods first, then everything else, each run alphabetical.
 *
 * Within a category rather than across the whole list: a food you wrote is
 * the one you are most likely to be looking for, but moving it out of its
 * section to do that would cost more than it gains.
 */
export function byMineThenName(a: Food, b: Food): number {
  const mine = Number(b.source === 'user') - Number(a.source === 'user')
  return mine !== 0 ? mine : a.name.localeCompare(b.name)
}

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
