import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Start new screens at the top, and put you back where you were on Back.
 *
 * React Router does not touch scroll position, and its `<ScrollRestoration>`
 * only works with a data router — this app uses `HashRouter`, so it has to be
 * done by hand. Without it, opening "Add to breakfast" from a scrolled Progress
 * screen lands you part-way down a list you have never seen.
 *
 * Going forward always starts at the top; going Back restores the position of
 * that specific history entry, which is what makes returning to a long food
 * list bearable.
 */
export default function ScrollManager() {
  const { key } = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())

  // Record where this entry is scrolled to, so Back can return to it.
  useEffect(() => {
    const remember = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', remember, { passive: true })
    return () => {
      remember()
      window.removeEventListener('scroll', remember)
    }
  }, [key])

  // Before paint, so there is no visible jump.
  useLayoutEffect(() => {
    const target = navigationType === 'POP' ? (positions.current.get(key) ?? 0) : 0
    window.scrollTo(0, target)
  }, [key, navigationType])

  return null
}
