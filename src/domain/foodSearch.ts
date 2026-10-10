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
/** Your own foods first, then everything else, each run alphabetical. */
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
  /*
   * Sections holding anything of your own come first, then the rest
   * alphabetically.
   *
   * Sorting your foods to the top WITHIN a section looked right and did
   * nothing: foods adopted from a photo, a barcode or Gemini are filed under
   * where they came from, so each one is alone in a section of its own and
   * had nothing to be sorted above. What buries them is the section order —
   * "From Gemini" lands between "Fish & seafood" and "Fruit". So the sections
   * move, and nothing moves out of the section it belongs to.
   */
  const isMine = (items: Food[]) => items.some((food) => food.source === 'user')
  return [...groups.entries()].sort(([aName, aItems], [bName, bItems]) => {
    const mine = Number(isMine(bItems)) - Number(isMine(aItems))
    return mine !== 0 ? mine : aName.localeCompare(bName)
  })
}
