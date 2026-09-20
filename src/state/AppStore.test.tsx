import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStoreProvider, loadInitialState, useStore } from './AppStore'
import { DEFAULT_GOALS, STORAGE_KEYS, repository } from '../storage/repository'
import { SEED_VERSION, seedFoods } from '../storage/seed'
import { createFood } from './factories'

function Probe() {
  const { state, dispatch, storageError } = useStore()
  return (
    <div>
      <p data-testid="foods">{state.foods.length}</p>
      <p data-testid="kcal">{state.goals.kcal}</p>
      <p data-testid="error">{storageError ?? 'none'}</p>
      <button
        type="button"
        onClick={() => dispatch({ type: 'goals/set', goals: { ...DEFAULT_GOALS, kcal: 2400 } })}
      >
        raise goal
      </button>
    </div>
  )
}

const renderStore = () =>
  render(
    <AppStoreProvider>
      <Probe />
    </AppStoreProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('loadInitialState', () => {
  it('seeds the starter foods on a fresh browser', () => {
    const state = loadInitialState()
    expect(state.foods).toHaveLength(seedFoods.length)
    expect(state.meta.seedVersion).toBe(SEED_VERSION)
  })

  it('does not re-seed a browser that already has the current revision', () => {
    repository.saveMeta({ seedVersion: SEED_VERSION })
    repository.saveFoods([])
    expect(loadInitialState().foods).toEqual([])
  })

  it('tops up a browser left on an older seed revision', () => {
    const mine = createFood({
      name: 'Mine',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, protein: 0, salt: 0 },
    })
    repository.saveMeta({ seedVersion: 0 })
    repository.saveFoods([mine])

    const state = loadInitialState()
    expect(state.foods).toHaveLength(seedFoods.length + 1)
    expect(state.foods[0]).toEqual(mine)
  })
})

describe('AppStoreProvider', () => {
  it('persists a change back to localStorage', async () => {
    const user = userEvent.setup()
    renderStore()

    await user.click(screen.getByRole('button', { name: 'raise goal' }))

    expect(screen.getByTestId('kcal')).toHaveTextContent('2400')
    expect(repository.loadGoals().kcal).toBe(2400)
  })

  it('writes the seeded foods on first run', () => {
    renderStore()
    expect(repository.loadFoods()).toHaveLength(seedFoods.length)
    expect(localStorage.getItem(STORAGE_KEYS.meta)).toContain(String(SEED_VERSION))
  })

  it('surfaces a failed write instead of losing it silently', async () => {
    const user = userEvent.setup()
    renderStore()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await user.click(screen.getByRole('button', { name: 'raise goal' }))

    expect(screen.getByTestId('error')).toHaveTextContent(/storage may be full/i)
  })

  it('refuses to be used outside the provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/must be used inside an AppStoreProvider/)
    quiet.mockRestore()
  })
})
