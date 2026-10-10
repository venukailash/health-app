import { describe, expect, it } from 'vitest'
import { byMineThenName, groupByCategory, matchesQuery } from './foodSearch'
import type { Food } from './types'

const food = (overrides: Partial<Food>): Food => ({
  id: 'f1',
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 0, protein: 11, salt: 0.02 },
  source: 'seed',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('matchesQuery', () => {
  it('matches everything on an empty or whitespace query', () => {
    expect(matchesQuery(food({}), '')).toBe(true)
    expect(matchesQuery(food({}), '   ')).toBe(true)
  })

  it('matches part of the name, ignoring case', () => {
    expect(matchesQuery(food({}), 'OAT')).toBe(true)
    expect(matchesQuery(food({}), 'kumquat')).toBe(false)
  })

  it('matches on brand and category too', () => {
    const branded = food({ brand: 'Quaker', category: 'Bread, grains & cereals' })
    expect(matchesQuery(branded, 'quaker')).toBe(true)
    expect(matchesQuery(branded, 'grains')).toBe(true)
  })

  it('copes with a food that has no brand or category', () => {
    expect(matchesQuery(food({ brand: undefined, category: undefined }), 'quaker')).toBe(false)
  })
})

describe('groupByCategory', () => {
  it('buckets foods and sorts the headings', () => {
    const groups = groupByCategory([
      food({ id: '1', name: 'Milk', category: 'Dairy & eggs' }),
      food({ id: '2', name: 'Oats', category: 'Bread, grains & cereals' }),
      food({ id: '3', name: 'Cheese', category: 'Dairy & eggs' }),
    ])

    expect(groups.map(([heading]) => heading)).toEqual([
      'Bread, grains & cereals',
      'Dairy & eggs',
    ])
    expect(groups[1][1]).toHaveLength(2)
  })

  it('files uncategorised foods under Other', () => {
    const groups = groupByCategory([
      food({ id: '1', category: undefined }),
      food({ id: '2', category: '   ' }),
    ])
    expect(groups).toEqual([['Other', expect.any(Array)]])
    expect(groups[0][1]).toHaveLength(2)
  })

  it('returns nothing for an empty library', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('byMineThenName', () => {
  const named = (name: string, source: 'seed' | 'user') => food({ id: `${source}-${name}`, name, source })

  it('puts your own foods before the bundled ones', () => {
    const sorted = [named('Apple', 'seed'), named('Zuppa', 'user')].sort(byMineThenName)
    expect(sorted.map((item) => item.name)).toEqual(['Zuppa', 'Apple'])
  })

  it('keeps each run alphabetical', () => {
    const sorted = [
      named('Oats', 'seed'),
      named('Banana', 'user'),
      named('Apple', 'seed'),
      named('Almonds', 'user'),
    ].sort(byMineThenName)
    expect(sorted.map((item) => item.name)).toEqual(['Almonds', 'Banana', 'Apple', 'Oats'])
  })

  it('is a total order, so the sort is stable whatever the input order', () => {
    const items = [named('B', 'user'), named('A', 'seed'), named('A', 'user'), named('B', 'seed')]
    const forwards = [...items].sort(byMineThenName).map((i) => `${i.source}:${i.name}`)
    const backwards = [...items].reverse().sort(byMineThenName).map((i) => `${i.source}:${i.name}`)
    expect(forwards).toEqual(backwards)
    expect(forwards).toEqual(['user:A', 'user:B', 'seed:A', 'seed:B'])
  })
})

describe('groupByCategory — sections holding your own foods', () => {
  const named = (name: string, category: string, source: 'seed' | 'user') =>
    food({ id: `${source}-${name}`, name, category, source })

  it('puts them first, whatever letter they start with', () => {
    // The real shape of the problem: adopted foods are filed by where they
    // came from, so "From Gemini" sat between "Fish" and "Fruit".
    const groups = groupByCategory([
      named('Cod', 'Fish & seafood', 'seed'),
      named('Banana', 'Fruit', 'seed'),
      named('Bagel', 'Bread, grains & cereals', 'seed'),
      named('ivy gourd', 'From photos', 'user'),
      named('Tesco eggs', 'From barcode database', 'user'),
    ])

    // Mixed case across two names would make this depend on the collation
    // locale, which CI and a laptop do not share.
    expect(groups.map(([name]) => name)).toEqual([
      'From barcode database',
      'From photos',
      'Bread, grains & cereals',
      'Fish & seafood',
      'Fruit',
    ])
  })

  it('counts a section as yours when any one food in it is', () => {
    const groups = groupByCategory([
      named('Apple', 'Fruit', 'seed'),
      named('Anna jam', 'Preserves', 'user'),
      named('Shop jam', 'Preserves', 'seed'),
    ])

    expect(groups.map(([name]) => name)).toEqual(['Preserves', 'Fruit'])
  })

  it('falls back to alphabetical when nothing is yours', () => {
    const groups = groupByCategory([
      named('Cod', 'Fish & seafood', 'seed'),
      named('Bagel', 'Bread, grains & cereals', 'seed'),
    ])

    expect(groups.map(([name]) => name)).toEqual(['Bread, grains & cereals', 'Fish & seafood'])
  })
})
