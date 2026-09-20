import { describe, expect, it } from 'vitest'
import { ImportError, backupFilename, buildBackup, parseBackup } from './transfer'
import { EMPTY_STATE, type AppState } from './reducer'
import { createFood, createRecipe, logFood } from './factories'
import { DEFAULT_GOALS, SCHEMA_VERSION } from '../storage/repository'

const oats = createFood({
  name: 'Porridge oats',
  category: 'Bread, grains & cereals',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 0, protein: 11, salt: 0.02 },
  defaultServing: { label: '40 g serving', grams: 40 },
})

const state: AppState = {
  ...EMPTY_STATE,
  foods: [oats],
  recipes: [createRecipe({ name: 'Overnight oats', servings: 2, ingredients: [{ foodId: oats.id, grams: 100 }] })],
  log: { '2026-09-20': [logFood(oats, 40, 'breakfast', '2026-09-20')] },
  goals: { ...DEFAULT_GOALS, kcal: 2200 },
  meta: { seedVersion: 1 },
}

const roundTrip = (value: AppState): AppState =>
  parseBackup(JSON.stringify(buildBackup(value)))

describe('buildBackup', () => {
  it('stamps the app name, schema version and export time', () => {
    const backup = buildBackup(state)
    expect(backup.app).toBe('health-app')
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION)
    expect(Date.parse(backup.exportedAt)).not.toBeNaN()
  })
})

describe('API key handling', () => {
  it('never writes the food database key into a backup', () => {
    const withKey: AppState = { ...state, meta: { seedVersion: 1, fdcApiKey: 'SECRET-KEY' } }
    const serialised = JSON.stringify(buildBackup(withKey))

    expect(serialised).not.toContain('SECRET-KEY')
    expect(serialised).not.toContain('fdcApiKey')
  })

  it('still carries the rest of meta', () => {
    const withKey: AppState = { ...state, meta: { seedVersion: 3, fdcApiKey: 'SECRET-KEY' } }
    expect(buildBackup(withKey).state.meta.seedVersion).toBe(3)
  })

  it('leaves the key in place on the live state it was built from', () => {
    const withKey: AppState = { ...state, meta: { seedVersion: 1, fdcApiKey: 'SECRET-KEY' } }
    buildBackup(withKey)
    expect(withKey.meta.fdcApiKey).toBe('SECRET-KEY')
  })

  it('ignores any key present in a file being imported', () => {
    const doctored = JSON.stringify({
      app: 'health-app',
      schemaVersion: 2,
      state: { meta: { seedVersion: 1, fdcApiKey: 'FROM-SOMEONE-ELSE' } },
    })
    expect(parseBackup(doctored).meta.fdcApiKey).toBeUndefined()
  })
})

describe('backupFilename', () => {
  it('uses the local date', () => {
    expect(backupFilename(new Date(2026, 8, 20))).toBe('health-app-backup-2026-09-20.json')
  })
})

describe('parseBackup round trip', () => {
  it('restores every store intact', () => {
    expect(roundTrip(state)).toEqual(state)
  })

  it('restores an empty backup', () => {
    expect(roundTrip(EMPTY_STATE)).toEqual(EMPTY_STATE)
  })

  it('preserves optional food fields', () => {
    const restored = roundTrip(state).foods[0]
    expect(restored.category).toBe('Bread, grains & cereals')
    expect(restored.defaultServing).toEqual({ label: '40 g serving', grams: 40 })
  })
})

describe('parseBackup rejection', () => {
  it('rejects non-JSON', () => {
    expect(() => parseBackup('nope{')).toThrow(ImportError)
  })

  it('rejects a JSON file from another app', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', state: {} }))).toThrow(
      /does not look like a Health App backup/,
    )
  })

  it('rejects a backup with no state', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'health-app' }))).toThrow(
      /missing its data/,
    )
  })
})

describe('parseBackup sanitising', () => {
  const importState = (partial: unknown): AppState =>
    parseBackup(JSON.stringify({ app: 'health-app', schemaVersion: 1, state: partial }))

  it('drops foods with missing or non-numeric nutrition', () => {
    const result = importState({
      foods: [
        oats,
        { id: 'bad', name: 'No nutrition' },
        { id: 'bad2', name: 'Text values', per100g: { kcal: 'lots' } },
        { id: 'bad3', name: 'Negative', per100g: { ...oats.per100g, fat: -5 } },
      ],
    })
    expect(result.foods.map((food) => food.id)).toEqual([oats.id])
  })

  it('drops log entries with an unknown meal or bad reference', () => {
    const good = logFood(oats, 40, 'breakfast', '2026-09-20')
    const result = importState({
      log: {
        '2026-09-20': [
          good,
          { ...good, id: 'b1', meal: 'brunch' },
          { ...good, id: 'b2', ref: { kind: 'food', id: 'x' } },
          { ...good, id: 'b3', nutrients: null },
        ],
      },
    })
    expect(result.log['2026-09-20'].map((entry) => entry.id)).toEqual([good.id])
  })

  it('drops whole days with an invalid date key', () => {
    const good = logFood(oats, 40, 'breakfast', '2026-09-20')
    const result = importState({
      log: {
        '2026-09-20': [good],
        'not-a-date': [good],
        '2026-02-30': [good],
      },
    })
    expect(Object.keys(result.log)).toEqual(['2026-09-20'])
  })

  it('rewrites each entry date to match the bucket it was filed under', () => {
    const stray = { ...logFood(oats, 40, 'breakfast', '1999-01-01'), id: 'stray' }
    const result = importState({ log: { '2026-09-20': [stray] } })
    expect(result.log['2026-09-20'][0].date).toBe('2026-09-20')
  })

  it('drops recipe ingredients that are malformed but keeps the recipe', () => {
    const result = importState({
      recipes: [
        {
          id: 'r1',
          name: 'Half broken',
          servings: 2,
          ingredients: [{ foodId: oats.id, grams: 100 }, { foodId: 5 }, null],
        },
      ],
    })
    expect(result.recipes[0].ingredients).toEqual([{ foodId: oats.id, grams: 100 }])
  })

  it('drops recipes with no valid id, name or yield', () => {
    const result = importState({
      recipes: [{ id: 'r1', name: 'No yield', ingredients: [] }, { name: 'No id', servings: 2, ingredients: [] }],
    })
    expect(result.recipes).toEqual([])
  })

  it('falls back to default goals when goals are unusable', () => {
    expect(importState({ goals: { kcal: 'loads' } }).goals).toEqual(DEFAULT_GOALS)
    expect(importState({}).goals).toEqual(DEFAULT_GOALS)
  })

  it('tolerates entirely missing collections', () => {
    const result = importState({})
    expect(result.foods).toEqual([])
    expect(result.recipes).toEqual([])
    expect(result.log).toEqual({})
  })
})
