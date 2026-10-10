import { describe, expect, it } from 'vitest'
import { findMatchingFood, normaliseName } from './matchFood'
import type { Food } from './types'

const food = (name: string, source: Food['source'] = 'seed'): Food => ({
  id: name,
  name,
  per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
  source,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const library = [
  food('Whole milk'),
  food('Semi-skimmed milk'),
  food('Milk chocolate'),
  food('Egg, whole'),
  food('Chicken breast, skinless, cooked'),
  food('Black coffee'),
  food('Tomato'),
]

describe('normaliseName', () => {
  it('strips punctuation, brackets and filler words', () => {
    expect(normaliseName('Egg, whole (large)')).toBe('egg')
    expect(normaliseName('Milk — Fresh Whole')).toBe('milk')
  })
})

describe('findMatchingFood', () => {
  it('matches an exact name', () => {
    expect(findMatchingFood('Whole milk', library)?.name).toBe('Whole milk')
  })

  it('matches regardless of case and punctuation', () => {
    expect(findMatchingFood('whole milk!', library)?.name).toBe('Whole milk')
  })

  it('prefers the closest name, not merely one that contains the word', () => {
    // "milk" must not land on "Milk chocolate".
    expect(findMatchingFood('milk', library)?.name).toMatch(/milk$/i)
    expect(findMatchingFood('milk', library)?.name).not.toBe('Milk chocolate')
  })

  it('does not match a different food that shares a word', () => {
    expect(findMatchingFood('coffee cake', library)).toBeUndefined()
    expect(findMatchingFood('chocolate cake', library)).toBeUndefined()
  })

  it('copes with plurals', () => {
    expect(findMatchingFood('eggs', library)?.name).toBe('Egg, whole')
    expect(findMatchingFood('tomatoes', library)?.name).toBe('Tomato')
  })

  it('matches a longer library name from a shorter ingredient', () => {
    expect(findMatchingFood('chicken breast', library)?.name).toBe(
      'Chicken breast, skinless, cooked',
    )
  })

  it('returns nothing when there is no sensible match', () => {
    expect(findMatchingFood('quinoa', library)).toBeUndefined()
    expect(findMatchingFood('', library)).toBeUndefined()
    expect(findMatchingFood('milk', [])).toBeUndefined()
  })

  it("prefers the user's own food over a starter food", () => {
    const mine = food('Whole milk', 'user')
    expect(findMatchingFood('whole milk', [...library, mine])?.source).toBe('user')
  })
})
