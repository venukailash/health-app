import { useEffect, useState, type RefObject } from 'react'

const GAP = 6
/** How long a smooth scroll is given to finish before another is considered. */
const SCROLL_SETTLE_MS = 350
const MAX_SCROLLS = 6

export interface SpotlightState {
  /** Whether there is something to point at right now. */
  visible: boolean
  /** Which side of the hole has more room for the card. */
  cardAtTop: boolean
}

const HIDDEN: SpotlightState = { visible: false, cardAtTop: false }

/**
 * Keeps `ring` sitting exactly on top of the element marked
 * `data-tour="<anchor>"`, and says where a card could go beside it.
 *
 * The ring is positioned by writing to its style in the measuring frame, not
 * by re-rendering. Going through React state meant the ring was drawn from
 * the previous frame's numbers, so it visibly lagged the page during a scroll.
 * Only the two coarse facts below go through state, and only when they flip.
 *
 * `visible: false` is a normal state, not a failure: the element is missing
 * while a route is still changing, and may never arrive if a layout dropped
 * it. The caller falls back to a plain centred card.
 */
export function useSpotlight(
  anchor: string | undefined,
  active: boolean,
  ring: RefObject<HTMLElement | null>,
): SpotlightState {
  const [state, setState] = useState<SpotlightState>(HIDDEN)

  useEffect(() => {
    if (!active || !anchor) return

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

    const publish = (next: SpotlightState) =>
      setState((current) =>
        current.visible === next.visible && current.cardAtTop === next.cardAtTop ? current : next,
      )

    const measure = (now: number) => {
      frame = requestAnimationFrame(measure)

      const element = document.querySelector(`[data-tour="${anchor}"]`)
      const node = ring.current
      if (!element || !node) {
        publish(HIDDEN)
        return
      }

      const box = element.getBoundingClientRect()
      // A zero-sized box means hidden, not found: no useful hole to cut.
      if (box.width <= 0 || box.height <= 0) {
        publish(HIDDEN)
        return
      }

      // Re-issued rather than fired once, because the scroll the ROUTER does
      // on a route change can land after ours and undo it, and because late
      // content above the target moves it. Capped and abandoned the moment
      // the reader scrolls, so it converges instead of fighting anyone.
      const offCentre = Math.abs(box.top + box.height / 2 - window.innerHeight / 2)
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

      node.style.top = `${box.top - GAP}px`
      node.style.left = `${box.left - GAP}px`
      node.style.width = `${box.width + GAP * 2}px`
      node.style.height = `${box.height + GAP * 2}px`

      publish({
        visible: true,
        cardAtTop: box.top > window.innerHeight - (box.top + box.height),
      })
    }

    frame = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(frame)
      for (const name of events) window.removeEventListener(name, surrender)
    }
  }, [anchor, active, ring])

  return active && anchor ? state : HIDDEN
}
