import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { StorageWriteError, repository } from '../storage/repository'
import { SEED_VERSION } from '../storage/seed'
import { EMPTY_STATE, reducer, type Action, type AppState } from './reducer'

interface StoreValue {
  state: AppState
  dispatch: (action: Action) => void
  /** Set when a write to localStorage failed, e.g. the quota is full. */
  storageError: string | null
  dismissStorageError: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

/**
 * Read every store once, then top up the starter foods if this browser has
 * not seen the current seed revision. Runs lazily inside useReducer so it
 * happens exactly once, before first paint.
 */
export function loadInitialState(): AppState {
  const loaded: AppState = {
    foods: repository.loadFoods(),
    recipes: repository.loadRecipes(),
    log: repository.loadLog(),
    goals: repository.loadGoals(),
    activity: repository.loadActivity(),
    activityGoals: repository.loadActivityGoals(),
    meta: repository.loadMeta(),
  }
  if (loaded.meta.seedVersion < SEED_VERSION) {
    return reducer(loaded, { type: 'seed/apply', seedVersion: SEED_VERSION })
  }
  return loaded
}

export function AppStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode
  /** Injected by tests; production loads from localStorage. */
  initialState?: AppState
}) {
  const [state, dispatch] = useReducer(reducer, initialState ?? EMPTY_STATE, (fallback) =>
    initialState ? fallback : loadInitialState(),
  )
  const [storageError, setStorageError] = useState<string | null>(null)

  const persist = useCallback((save: () => void) => {
    try {
      save()
      setStorageError((current) => (current === null ? current : null))
    } catch (error) {
      if (error instanceof StorageWriteError) setStorageError(error.message)
      else throw error
    }
  }, [])

  // One effect per store so an unrelated change does not rewrite every key.
  useEffect(() => persist(() => repository.saveFoods(state.foods)), [state.foods, persist])
  useEffect(() => persist(() => repository.saveRecipes(state.recipes)), [state.recipes, persist])
  useEffect(() => persist(() => repository.saveLog(state.log)), [state.log, persist])
  useEffect(() => persist(() => repository.saveGoals(state.goals)), [state.goals, persist])
  useEffect(() => persist(() => repository.saveMeta(state.meta)), [state.meta, persist])
  useEffect(() => persist(() => repository.saveActivity(state.activity)), [state.activity, persist])
  useEffect(
    () => persist(() => repository.saveActivityGoals(state.activityGoals)),
    [state.activityGoals, persist],
  )

  const dismissStorageError = useCallback(() => setStorageError(null), [])

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, storageError, dismissStorageError }),
    [state, storageError, dismissStorageError],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside an AppStoreProvider')
  return value
}

export function useAppState(): AppState {
  return useStore().state
}

export function useDispatch(): (action: Action) => void {
  return useStore().dispatch
}
