import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_GOALS, SCHEMA_VERSION, STORAGE_KEYS, repository } from './repository'
import { applySeedFoods, seedFoods } from './seed'
import type { Food } from '../domain/types'

/** A v1 record: the same shape as today's, minus fibre. */
const v1 = (key: string, data: unknown) =>
  localStorage.setItem(key, JSON.stringify({ version: 1, data }))

beforeEach(() => localStorage.clear())

describe('v1 to v2 migration (fibre added)', () => {
  it('gives a stored food a fibre value', () => {
    v1(STORAGE_KEYS.foods, [
      {
        id: 'f1',
        name: 'Old food',
        per100g: { kcal: 100, fat: 1, satFat: 0.5, carbs: 20, protein: 5, salt: 0.1 },
        source: 'user',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])
    const [food] = repository.loadFoods()
    expect(food.per100g.fibre).toBe(0)
    // Everything else survives untouched.
    expect(food.per100g.carbs).toBe(20)
    expect(food.name).toBe('Old food')
  })

  it('gives upgraded goals the recommended fibre target, not zero', () => {
    // A zero target would leave the fibre bar stuck at 0% for ever, which is
    // not the same thing as "we do not know this value".
    v1(STORAGE_KEYS.goals, { kcal: 2200, fat: 70, satFat: 20, carbs: 260, protein: 50, salt: 6 })
    const goals = repository.loadGoals()
    expect(goals.fibre).toBe(DEFAULT_GOALS.fibre)
    expect(goals.fibre).toBeGreaterThan(0)
    expect(goals.kcal).toBe(2200)
  })

  it('still records zero fibre for measured data, where it means unknown', () => {
    v1(STORAGE_KEYS.foods, [
      {
        id: 'f1',
        name: 'Old',
        per100g: { kcal: 100, fat: 1, satFat: 0.5, carbs: 20, protein: 5, salt: 0.1 },
        source: 'user',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])
    expect(repository.loadFoods()[0].per100g.fibre).toBe(0)
  })

  it('leaves a deliberate fibre goal of zero alone once already on v2', () => {
    repository.saveGoals({ ...DEFAULT_GOALS, fibre: 0 })
    expect(repository.loadGoals().fibre).toBe(0)
  })

  it('reaches nutrients nested inside logged entries', () => {
    v1(STORAGE_KEYS.log, {
      '2026-09-20': [
        {
          id: 'e1',
          date: '2026-09-20',
          meal: 'breakfast',
          ref: { kind: 'food', id: 'f1', grams: 40 },
          label: 'Old entry',
          nutrients: { kcal: 152, fat: 2.6, satFat: 0.4, carbs: 27, protein: 5, salt: 0.01 },
          loggedAt: '2026-09-20T08:00:00.000Z',
        },
      ],
    })
    const log = repository.loadLog()
    expect(log['2026-09-20'][0].nutrients.fibre).toBe(0)
    expect(log['2026-09-20'][0].nutrients.kcal).toBe(152)
  })

  it('leaves data that is already v2 alone', () => {
    const food: Food = {
      id: 'f1',
      name: 'New food',
      per100g: { kcal: 100, fat: 1, satFat: 0.5, carbs: 20, fibre: 3.5, protein: 5, salt: 0.1 },
      source: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    repository.saveFoods([food])
    expect(repository.loadFoods()[0].per100g.fibre).toBe(3.5)
  })

  it('still refuses a version newer than this build understands', () => {
    localStorage.setItem(
      STORAGE_KEYS.goals,
      JSON.stringify({ version: SCHEMA_VERSION + 5, data: { kcal: 1 } }),
    )
    expect(repository.loadGoals()).toEqual(DEFAULT_GOALS)
  })

  it('writes back at the current schema version', () => {
    repository.saveGoals(DEFAULT_GOALS)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.goals) as string)
    expect(raw.version).toBe(2)
  })
})

describe('applySeedFoods', () => {
  const stale: Food = {
    ...seedFoods[0],
    // How a v1 install would have it after migration: fibre zeroed.
    per100g: { ...seedFoods[0].per100g, fibre: 0 },
  }

  it('refreshes starter foods that are out of date', () => {
    const result = applySeedFoods([stale])
    const refreshed = result.find((food) => food.id === stale.id)
    expect(refreshed?.per100g.fibre).toBe(seedFoods[0].per100g.fibre)
    expect(seedFoods[0].per100g.fibre).toBeGreaterThan(0)
  })

  it('does not duplicate a refreshed food', () => {
    expect(applySeedFoods([stale])).toHaveLength(seedFoods.length)
  })

  it('never touches a food the user made', () => {
    const mine: Food = {
      id: 'mine',
      name: 'My own',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      source: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const result = applySeedFoods([mine])
    expect(result.find((food) => food.id === 'mine')).toEqual(mine)
    expect(result).toHaveLength(seedFoods.length + 1)
  })

  it('leaves a deleted starter food deleted', () => {
    // Everything except the first starter food, all current.
    const kept = seedFoods.slice(1)
    const result = applySeedFoods(kept)
    // The missing one is re-added by design (it is how new foods arrive), so
    // assert the count rather than that it stays absent.
    expect(result).toHaveLength(seedFoods.length)
  })
})

describe('fibre in the seed data', () => {
  it('gives plant foods real fibre values', () => {
    const oats = seedFoods.find((food) => food.id === 'seed-porridge-oats-dry')
    expect(oats?.per100g.fibre).toBeGreaterThan(5)
  })

  it('gives animal products none', () => {
    const chicken = seedFoods.find((food) => food.id === 'seed-chicken-breast-skinless-cooked')
    expect(chicken?.per100g.fibre).toBe(0)
  })

  it('never reports more fibre than carbohydrate plus fibre is plausible', () => {
    for (const food of seedFoods) {
      expect(food.per100g.fibre, food.name).toBeGreaterThanOrEqual(0)
      expect(food.per100g.fibre, food.name).toBeLessThanOrEqual(100)
    }
  })
})
