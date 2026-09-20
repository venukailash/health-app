import { describe, expect, it } from 'vitest'
import { groupByCategory, matchesQuery } from './foodSearch'
import type { Food } from './types'

const food = (overrides: Partial<Food>): Food => ({
  id: 'f1',
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, protein: 11, salt: 0.02 },
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
