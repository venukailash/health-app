import { useCallback, useEffect, useRef, useState } from 'react'
import { LookupFailedError, RateLimitedError } from '../services/openFoodFacts'
import { searchFoods, type SearchedFood } from '../services/foodDataCentral'
import { useToast } from '../state/ToastProvider'
import { useAppState } from '../state/AppStore'

/** Long enough that typing a food name is one request, not ten. */
const DEBOUNCE_MS = 600

export interface RemoteSearchState {
  results: SearchedFood[]
  loading: boolean
  /** Set when the last attempt failed; clears on the next successful search. */
  error: 'rate-limited' | 'unavailable' | null
}

/**
 * Debounced Open Food Facts search.
 *
 * Results are cached per query for the life of the screen, so going back and
 * forth over the same term costs nothing. Failures surface as a toast and
 * leave the previous results on screen rather than blanking them — and the
 * next search simply tries again, so a rate limit clears itself without the
 * user doing anything.
 */
export function useRemoteFoodSearch(query: string, enabled = true): RemoteSearchState {
  const { showToast } = useToast()
  const { meta } = useAppState()
  const apiKey = meta.fdcApiKey
  const [state, setState] = useState<RemoteSearchState>({
    results: [],
    loading: false,
    error: null,
  })
  const cache = useRef(new Map<string, SearchedFood[]>())
  const lastToast = useRef(0)

  // One toast per failure burst: a run of failing keystrokes should not stack.
  const warn = useCallback(
    (message: string) => {
      const now = Date.now()
      if (now - lastToast.current < 5000) return
      lastToast.current = now
      showToast(message, { tone: 'error' })
    },
    [showToast],
  )

  useEffect(() => {
    const terms = query.trim()
    if (!enabled || terms.length < 2) {
      setState({ results: [], loading: false, error: null })
      return
    }

    const cached = cache.current.get(terms.toLowerCase())
    if (cached) {
      setState({ results: cached, loading: false, error: null })
      return
    }

    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true }))

    const timer = setTimeout(async () => {
      try {
        const results = await searchFoods(terms, { signal: controller.signal, apiKey })
        cache.current.set(terms.toLowerCase(), results)
        setState({ results, loading: false, error: null })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        if (error instanceof RateLimitedError) {
          setState((current) => ({ ...current, loading: false, error: 'rate-limited' }))
          const seconds = Math.max(1, Math.ceil((error.retryAt - Date.now()) / 1000))
          warn(
            apiKey
              ? `Food database is busy. Search again in about ${seconds}s.`
              : 'Shared demo key is out of requests. Add your own free key in Settings.',
          )
          return
        }

        setState((current) => ({ ...current, loading: false, error: 'unavailable' }))
        if (error instanceof LookupFailedError) {
          warn('Could not reach the food database. Your own foods still work.')
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled, warn, apiKey])

  return state
}
