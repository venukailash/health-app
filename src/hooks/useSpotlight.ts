import { useEffect, useState, type RefObject } from 'react'

const GAP = 6
/** How long a smooth scroll is given to finish before another is considered. */
const SCROLL_SETTLE_MS = 350
const MAX_SCROLLS = 6
/**
 * The share of the screen the card is assumed to occupy along the bottom.
 * Generous on purpose: targets are scrolled into the space above it, and a
 * target sitting a little higher than it needed to costs nothing, while one
 * behind the card is the whole bug.
 */
const RESERVED = 0.45

export interface SpotlightState {
  /** Whether there is something to point at right now. */
  visible: boolean
  /**
   * How far to lift the card off the bottom of the screen, in pixels. Zero
   * almost always: it is only for a target that is itself pinned to the
   * bottom — the floating assist button — which no amount of scrolling can
   * move out from under the card.
   */
  lift: number
}

const HIDDEN: SpotlightState = { visible: false, lift: 0 }

/**
 * Keeps `ring` sitting exactly on top of the element marked
 * `data-tour="<anchor>"`.
 *
 * The ring is positioned by writing to its style in the measuring frame, not
 * by re-rendering. Going through React state meant the ring was drawn from
 * the previous frame's numbers, so it visibly lagged the page during a scroll.
 * Only the two coarse facts above go through state, and only when they change.
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
    let lastScrollY = Number.NaN
    let userScrolled = false

    // Once the reader takes over, stop dragging them back.
    const surrender = () => {
      userScrolled = true
    }
    const events = ['wheel', 'touchmove', 'keydown'] as const
    for (const name of events) window.addEventListener(name, surrender, { passive: true })

    const publish = (next: SpotlightState) =>
      setState((current) =>
        current.visible === next.visible && current.lift === next.lift ? current : next,
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

      node.style.top = `${box.top - GAP}px`
      node.style.left = `${box.left - GAP}px`
      node.style.width = `${box.width + GAP * 2}px`
      node.style.height = `${box.height + GAP * 2}px`

      // The card is a bottom sheet, so the target belongs in the band above
      // it rather than in the middle of the window.
      const band = window.innerHeight * (1 - RESERVED)
      const wanted = Math.max(GAP * 2, (band - box.height) / 2)
      const pinned = window.getComputedStyle(element).position === 'fixed'

      if (pinned) {
        // Scrolling cannot move it, so the card moves instead.
        const overlaps = box.bottom > band
        publish({ visible: true, lift: overlaps ? window.innerHeight - box.top + GAP * 2 : 0 })
        return
      }

      // Re-issued rather than fired once, because the scroll the ROUTER does
      // on a route change can land after ours and undo it, and because late
      // content above the target moves it. Capped, abandoned the moment the
      // reader scrolls, and stopped as soon as a scroll changes nothing —
      // which is what happens at the end of a short page.
      if (
        !userScrolled &&
        scrolls < MAX_SCROLLS &&
        now - lastScrollAt > SCROLL_SETTLE_MS &&
        Math.abs(box.top - wanted) > window.innerHeight * 0.08
      ) {
        if (scrolls > 0 && window.scrollY === lastScrollY) {
          scrolls = MAX_SCROLLS
        } else {
          scrolls += 1
          lastScrollAt = now
          lastScrollY = window.scrollY
          const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          window.scrollBy({ top: box.top - wanted, behavior: still ? 'auto' : 'smooth' })
        }
      }

      publish({ visible: true, lift: 0 })
    }

    frame = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(frame)
      for (const name of events) window.removeEventListener(name, surrender)
    }
  }, [anchor, active, ring])

  return active && anchor ? state : HIDDEN
}
