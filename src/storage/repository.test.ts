import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GOALS,
  DEFAULT_META,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  StorageWriteError,
  read,
  repository,
  write,
} from './repository'
import type { Food, Goals, LogByDate } from '../domain/types'

const food: Food = {
  id: 'f1',
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 6.5, satFat: 1.1, carbs: 67.7, fibre: 0, protein: 13.2, salt: 0.02 },
  source: 'user',
  createdAt: '2026-09-20T08:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('read / write round trip', () => {
  it('returns what was written', () => {
    write(STORAGE_KEYS.foods, [food])
    expect(read<Food[]>(STORAGE_KEYS.foods, [])).toEqual([food])
  })

  it('wraps the payload in a versioned envelope', () => {
    write(STORAGE_KEYS.goals, DEFAULT_GOALS)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.goals) as string)
    expect(raw).toEqual({ version: SCHEMA_VERSION, data: DEFAULT_GOALS })
  })
})

describe('read fallbacks', () => {
  it('falls back when the key is absent', () => {
    expect(read(STORAGE_KEYS.goals, DEFAULT_GOALS)).toEqual(DEFAULT_GOALS)
  })

  it('falls back on malformed JSON rather than throwing', () => {
    localStorage.setItem(STORAGE_KEYS.foods, '{not json')
    expect(() => read<Food[]>(STORAGE_KEYS.foods, [])).not.toThrow()
    expect(read<Food[]>(STORAGE_KEYS.foods, [])).toEqual([])
  })

  it('falls back on an unwrapped legacy payload', () => {
    localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify([food]))
    expect(read<Food[]>(STORAGE_KEYS.foods, [])).toEqual([])
  })

  it('falls back on an unknown future schema version and leaves the data on disk', () => {
    const future = JSON.stringify({ version: SCHEMA_VERSION + 99, data: [food] })
    localStorage.setItem(STORAGE_KEYS.foods, future)
    expect(read<Food[]>(STORAGE_KEYS.foods, [])).toEqual([])
    expect(localStorage.getItem(STORAGE_KEYS.foods)).toBe(future)
  })

  it('falls back when the version is not a number', () => {
    localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify({ version: '1', data: [food] }))
    expect(read<Food[]>(STORAGE_KEYS.foods, [])).toEqual([])
  })

  it('falls back when the payload fails validation', () => {
    localStorage.setItem(
      STORAGE_KEYS.foods,
      JSON.stringify({ version: SCHEMA_VERSION, data: { nope: true } }),
    )
    expect(repository.loadFoods()).toEqual([])
  })

  it('falls back when an object store holds an array', () => {
    localStorage.setItem(
      STORAGE_KEYS.goals,
      JSON.stringify({ version: SCHEMA_VERSION, data: [1, 2, 3] }),
    )
    expect(repository.loadGoals()).toEqual(DEFAULT_GOALS)
  })
})

describe('write failures', () => {
  it('raises StorageWriteError when the quota is exceeded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => write(STORAGE_KEYS.foods, [food])).toThrow(StorageWriteError)
  })

  it('names the key in the error so the UI can report it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      write(STORAGE_KEYS.log, {})
      expect.unreachable('write should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(StorageWriteError)
      expect((error as StorageWriteError).key).toBe(STORAGE_KEYS.log)
      expect((error as StorageWriteError).message).toMatch(/storage may be full/i)
    }
  })

  it('reads fall back silently when getItem itself throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied')
    })
    expect(read(STORAGE_KEYS.goals, DEFAULT_GOALS)).toEqual(DEFAULT_GOALS)
  })
})

describe('repository helpers', () => {
  it('defaults goals and meta on a fresh profile', () => {
    expect(repository.loadGoals()).toEqual(DEFAULT_GOALS)
    expect(repository.loadMeta()).toEqual(DEFAULT_META)
    expect(repository.loadFoods()).toEqual([])
    expect(repository.loadRecipes()).toEqual([])
    expect(repository.loadLog()).toEqual({})
  })

  it('persists each store independently', () => {
    const goals: Goals = { ...DEFAULT_GOALS, kcal: 2400 }
    const log: LogByDate = {
      '2026-09-20': [
        {
          id: 'e1',
          date: '2026-09-20',
          meal: 'breakfast',
          ref: { kind: 'food', id: 'f1', grams: 40 },
          label: 'Porridge oats',
          nutrients: { kcal: 152, fat: 2.6, satFat: 0.4, carbs: 27.1, fibre: 0, protein: 5.3, salt: 0.01 },
          loggedAt: '2026-09-20T08:05:00.000Z',
        },
      ],
    }
    repository.saveGoals(goals)
    repository.saveFoods([food])
    repository.saveLog(log)
    repository.saveMeta({ seedVersion: 1 })

    expect(repository.loadGoals()).toEqual(goals)
    expect(repository.loadFoods()).toEqual([food])
    expect(repository.loadLog()).toEqual(log)
    expect(repository.loadMeta()).toEqual({ seedVersion: 1 })
  })

  it('clearAll removes every known key', () => {
    repository.saveGoals(DEFAULT_GOALS)
    repository.saveFoods([food])
    repository.clearAll()
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })
})
