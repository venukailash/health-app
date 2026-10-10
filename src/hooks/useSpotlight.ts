import { useEffect, useState } from 'react'

export interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const GAP = 8
/** How long a smooth scroll is given to finish before another is considered. */
const SCROLL_SETTLE_MS = 350
const MAX_SCROLLS = 6

function same(a: SpotlightRect | null, b: SpotlightRect | null): boolean {
  if (a === null || b === null) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

/**
 * Follows the element marked `data-tour="<anchor>"` and reports where it is.
 *
 * Measured every frame rather than on a list of events. The element may not
 * exist yet (the route is still changing), may move (the page scrolls, the
 * keyboard opens, a card above it expands) or may never appear at all, and one
 * rule covers all of it. A `getBoundingClientRect` per frame costs nothing
 * next to being subtly wrong.
 *
 * Returns null while there is nothing to point at, which is a normal state:
 * the caller falls back to a plain centred card.
 */
export function useSpotlight(anchor: string | undefined, active: boolean): SpotlightRect | null {
  const [rect, setRect] = useState<SpotlightRect | null>(null)

  useEffect(() => {
    if (!active || !anchor) {
      // Not cleared here: the value is simply not reported while inactive
      // (see the return below), which keeps this effect free of a setState
      // that would run on every mount.
      return
    }

    let frame = 0
    let scrolls = 0
    // -Infinity so the first scroll is immediate; the gap only paces retries.
    let lastScrollAt = Number.NEGATIVE_INFINITY
    let userScrolled = false

    // Once the reader takes over, stop dragging them back.
    const surrender = () => {
      userScrolled = true
    }
    const events = ['wheel', 'touchmove', 'keydown'] as const
    for (const name of events) window.addEventListener(name, surrender, { passive: true })

    const measure = (now: number) => {
      const element = document.querySelector(`[data-tour="${anchor}"]`)

      if (element) {
        const box = element.getBoundingClientRect()
        const offCentre = Math.abs(box.top + box.height / 2 - window.innerHeight / 2)

        // Re-issued rather than fired once, because the scroll the ROUTER does
        // on a route change can land after ours and undo it, and because late
        // content above the target moves it. Capped and abandoned the moment
        // the reader scrolls, so it converges instead of fighting anyone.
        if (
          !userScrolled &&
          scrolls < MAX_SCROLLS &&
          now - lastScrollAt > SCROLL_SETTLE_MS &&
          offCentre > window.innerHeight * 0.15
        ) {
          scrolls += 1
          lastScrollAt = now
          const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          element.scrollIntoView?.({ block: 'center', behavior: still ? 'auto' : 'smooth' })
        }

        // A zero-sized box means hidden, not found: no useful hole to cut.
        const next =
          box.width > 0 && box.height > 0
            ? {
                top: box.top - GAP,
                left: box.left - GAP,
                width: box.width + GAP * 2,
                height: box.height + GAP * 2,
              }
            : null
        setRect((current) => (same(current, next) ? current : next))
      } else {
        setRect((current) => (current === null ? current : null))
      }

      frame = requestAnimationFrame(measure)
    }

    frame = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(frame)
      for (const name of events) window.removeEventListener(name, surrender)
    }
  }, [anchor, active])

  return active && anchor ? rect : null
}
