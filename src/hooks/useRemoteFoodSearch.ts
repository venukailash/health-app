import { useCallback, useEffect, useRef, useState } from 'react'
import { searchAllSources, type FoundFood } from '../services/foodSearch'
import { useToast } from '../state/ToastProvider'
import { useAppState } from '../state/AppStore'

/** Long enough that typing a food name is one request, not ten. */
const DEBOUNCE_MS = 600

export interface RemoteSearchState {
  results: FoundFood[]
  loading: boolean
  /** Set when BOTH sources failed; clears on the next successful search. */
  error: 'rate-limited' | 'unavailable' | null
  /** One source answered and the other did not. Results are still usable. */
  partial: boolean
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
    partial: false,
  })
  const cache = useRef(new Map<string, FoundFood[]>())
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
      setState({ results: [], loading: false, error: null, partial: false })
      return
    }

    const cached = cache.current.get(terms.toLowerCase())
    if (cached) {
      setState({ results: cached, loading: false, error: null, partial: false })
      return
    }

    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true }))

    const timer = setTimeout(async () => {
      try {
        const { foods, partial, failure } = await searchAllSources(terms, {
          signal: controller.signal,
          apiKey,
        })
        if (controller.signal.aborted) return

        if (failure) {
          setState((current) => ({ ...current, loading: false, error: failure, partial: false }))
          warn(
            failure === 'rate-limited'
              ? apiKey
                ? 'Both food databases are busy. Try that search again shortly.'
                : 'Food databases are busy. Adding your own free key in Settings helps.'
              : 'Could not reach the food databases. Your own foods still work.',
          )
          return
        }

        // Only cache a complete answer: a partial one should be retried.
        if (!partial) cache.current.set(terms.toLowerCase(), foods)
        setState({ results: foods, loading: false, error: null, partial })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState((current) => ({ ...current, loading: false, error: 'unavailable', partial: false }))
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled, warn, apiKey])

  return state
}
