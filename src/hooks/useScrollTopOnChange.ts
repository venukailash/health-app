import { useLayoutEffect } from 'react'

/**
 * Scroll to the top when an in-page view changes.
 *
 * Several screens swap their whole contents without changing route — the
 * ingredient picker, the Gemini assist. Those are navigations as far as the
 * user is concerned, so they should start at the top like any other, but
 * `ScrollManager` never sees them because the URL does not move.
 */
export function useScrollTopOnChange(value: unknown): void {
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [value])
}
