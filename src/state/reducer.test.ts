import { describe, expect, it } from 'vitest'
import { EMPTY_STATE, reducer, type AppState } from './reducer'
import { createFood, createRecipe, logFood, logRecipe } from './factories'
import { seedFoods } from '../storage/seed'
import { DEFAULT_GOALS } from '../storage/repository'
import { foodsById } from './selectors'
import type { Food, LogEntry } from '../domain/types'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, protein: 11, salt: 0.02 },
})

const stateWith = (patch: Partial<AppState>): AppState => ({ ...EMPTY_STATE, ...patch })

describe('foods', () => {
  it('adds a food', () => {
    const next = reducer(EMPTY_STATE, { type: 'food/add', food: oats })
    expect(next.foods).toEqual([oats])
  })

  it('does not mutate the previous state', () => {
    const before = stateWith({ foods: [] })
    reducer(before, { type: 'food/add', food: oats })
    expect(before.foods).toEqual([])
  })

  it('updates a food in place, preserving order', () => {
    const other = createFood({
      name: 'Banana',
      per100g: { kcal: 89, fat: 0.3, satFat: 0.1, carbs: 20.3, protein: 1.1, salt: 0 },
    })
    const state = stateWith({ foods: [oats, other] })
    const corrected: Food = { ...oats, name: 'Porridge oats, dry' }
    const next = reducer(state, { type: 'food/update', food: corrected })
    expect(next.foods.map((food) => food.name)).toEqual(['Porridge oats, dry', 'Banana'])
  })

  it('deletes a food', () => {
    const state = stateWith({ foods: [oats] })
    expect(reducer(state, { type: 'food/delete', id: oats.id }).foods).toEqual([])
  })

  it('ignores a delete for an unknown id', () => {
    const state = stateWith({ foods: [oats] })
    expect(reducer(state, { type: 'food/delete', id: 'nope' }).foods).toEqual([oats])
  })

  it('leaves logged entries untouched when the food is later corrected', () => {
    const entry = logFood(oats, 40, 'breakfast', '2026-09-20')
    const state = stateWith({ foods: [oats], log: { '2026-09-20': [entry] } })
    const corrected: Food = { ...oats, per100g: { ...oats.per100g, kcal: 1000 } }
    const next = reducer(state, { type: 'food/update', food: corrected })
    expect(next.log['2026-09-20'][0].nutrients).toEqual(entry.nutrients)
  })

  it('leaves logged entries untouched when the food is deleted', () => {
    const entry = logFood(oats, 40, 'breakfast', '2026-09-20')
    const state = stateWith({ foods: [oats], log: { '2026-09-20': [entry] } })
    const next = reducer(state, { type: 'food/delete', id: oats.id })
    expect(next.log['2026-09-20']).toEqual([entry])
  })
})

describe('recipes', () => {
  const recipe = createRecipe({
    name: 'Overnight oats',
    servings: 2,
    ingredients: [{ foodId: oats.id, grams: 100 }],
  })

  it('adds, updates and deletes', () => {
    let state = reducer(EMPTY_STATE, { type: 'recipe/add', recipe })
    expect(state.recipes).toEqual([recipe])

    state = reducer(state, { type: 'recipe/update', recipe: { ...recipe, servings: 4 } })
    expect(state.recipes[0].servings).toBe(4)

    state = reducer(state, { type: 'recipe/delete', id: recipe.id })
    expect(state.recipes).toEqual([])
  })

  it('clamps the serving yield to at least 1 when created', () => {
    expect(createRecipe({ name: 'x', servings: 0, ingredients: [] }).servings).toBe(1)
    expect(createRecipe({ name: 'x', servings: -3, ingredients: [] }).servings).toBe(1)
  })
})

describe('log entries', () => {
  const entry = logFood(oats, 40, 'breakfast', '2026-09-20')

  it('adds an entry into its date bucket', () => {
    const next = reducer(EMPTY_STATE, { type: 'entry/add', entry })
    expect(next.log).toEqual({ '2026-09-20': [entry] })
  })

  it('appends to an existing day', () => {
    const second = logFood(oats, 60, 'lunch', '2026-09-20')
    let state = reducer(EMPTY_STATE, { type: 'entry/add', entry })
    state = reducer(state, { type: 'entry/add', entry: second })
    expect(state.log['2026-09-20']).toHaveLength(2)
  })

  it('keeps days separate', () => {
    const other = logFood(oats, 60, 'lunch', '2026-09-21')
    let state = reducer(EMPTY_STATE, { type: 'entry/add', entry })
    state = reducer(state, { type: 'entry/add', entry: other })
    expect(Object.keys(state.log).sort()).toEqual(['2026-09-20', '2026-09-21'])
  })

  it('updates an entry in place', () => {
    const state = stateWith({ log: { '2026-09-20': [entry] } })
    const edited: LogEntry = { ...entry, nutrients: { ...entry.nutrients, kcal: 500 } }
    const next = reducer(state, { type: 'entry/update', entry: edited })
    expect(next.log['2026-09-20']).toEqual([edited])
  })

  it('moves an entry when its date changes, leaving no duplicate behind', () => {
    const state = stateWith({ log: { '2026-09-20': [entry] } })
    const moved: LogEntry = { ...entry, date: '2026-09-21' }
    const next = reducer(state, { type: 'entry/update', entry: moved })
    expect(next.log['2026-09-20']).toBeUndefined()
    expect(next.log['2026-09-21']).toEqual([moved])
  })

  it('deletes an entry and removes the day once empty', () => {
    const state = stateWith({ log: { '2026-09-20': [entry] } })
    const next = reducer(state, { type: 'entry/delete', date: '2026-09-20', id: entry.id })
    expect(next.log['2026-09-20']).toBeUndefined()
  })

  it('keeps the day when other entries remain', () => {
    const second = logFood(oats, 60, 'lunch', '2026-09-20')
    const state = stateWith({ log: { '2026-09-20': [entry, second] } })
    const next = reducer(state, { type: 'entry/delete', date: '2026-09-20', id: entry.id })
    expect(next.log['2026-09-20']).toEqual([second])
  })

  it('ignores a delete for an unknown entry or day', () => {
    const state = stateWith({ log: { '2026-09-20': [entry] } })
    expect(reducer(state, { type: 'entry/delete', date: '2026-09-20', id: 'nope' }).log).toEqual(
      state.log,
    )
    expect(reducer(state, { type: 'entry/delete', date: '1999-01-01', id: entry.id }).log).toEqual(
      state.log,
    )
  })

  it('snapshots recipe nutrition per serving at log time', () => {
    const recipe = createRecipe({
      name: 'Chicken and rice',
      servings: 4,
      ingredients: [{ foodId: oats.id, grams: 400 }],
    })
    const logged = logRecipe(recipe, 1, foodsById([oats]), 'dinner', '2026-09-20')
    expect(Math.round(logged.nutrients.kcal)).toBe(379)
    expect(logged.ref).toEqual({ kind: 'recipe', id: recipe.id, servings: 1 })
    expect(logged.label).toBe('Chicken and rice')
  })

  it('scales a multi-serving recipe entry', () => {
    const recipe = createRecipe({
      name: 'Big batch',
      servings: 4,
      ingredients: [{ foodId: oats.id, grams: 400 }],
    })
    const logged = logRecipe(recipe, 2, foodsById([oats]), 'dinner', '2026-09-20')
    expect(Math.round(logged.nutrients.kcal)).toBe(758)
  })
})

describe('goals', () => {
  it('replaces the whole target set', () => {
    const goals = { ...DEFAULT_GOALS, kcal: 2400, protein: 140 }
    expect(reducer(EMPTY_STATE, { type: 'goals/set', goals }).goals).toEqual(goals)
  })
})

describe('seeding', () => {
  it('imports the starter library and records the version', () => {
    const next = reducer(EMPTY_STATE, { type: 'seed/apply', seedVersion: 1 })
    expect(next.foods).toHaveLength(seedFoods.length)
    expect(next.meta.seedVersion).toBe(1)
  })

  it('is idempotent — re-seeding adds nothing', () => {
    const once = reducer(EMPTY_STATE, { type: 'seed/apply', seedVersion: 1 })
    const twice = reducer(once, { type: 'seed/apply', seedVersion: 1 })
    expect(twice.foods).toHaveLength(seedFoods.length)
  })

  it('keeps user foods and tops up only what is missing', () => {
    const state = stateWith({ foods: [oats, seedFoods[0]] })
    const next = reducer(state, { type: 'seed/apply', seedVersion: 1 })
    expect(next.foods).toHaveLength(seedFoods.length + 1)
    expect(next.foods[0]).toEqual(oats)
  })
})

describe('whole-state actions', () => {
  it('hydrates from storage', () => {
    const loaded = stateWith({ foods: [oats], goals: { ...DEFAULT_GOALS, kcal: 1800 } })
    expect(reducer(EMPTY_STATE, { type: 'hydrate', state: loaded })).toEqual(loaded)
  })

  it('replaces everything on import', () => {
    const imported = stateWith({ foods: [oats] })
    const current = stateWith({ recipes: [createRecipe({ name: 'x', servings: 1, ingredients: [] })] })
    expect(reducer(current, { type: 'data/replace', state: imported })).toEqual(imported)
  })

  it('clears back to empty', () => {
    const state = stateWith({ foods: [oats], log: { '2026-09-20': [logFood(oats, 40, 'breakfast', '2026-09-20')] } })
    const next = reducer(state, { type: 'data/clear' })
    expect(next.foods).toEqual([])
    expect(next.log).toEqual({})
    expect(next.goals).toEqual(DEFAULT_GOALS)
  })
})
