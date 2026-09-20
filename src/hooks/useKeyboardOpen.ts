import { useEffect, useState } from 'react'

/**
 * True while the on-screen keyboard is covering part of the viewport.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens, so
 * a `position: fixed` bar keeps its place on screen and ends up floating over
 * the keyboard. The visual viewport does shrink, and the gap between the two
 * is the keyboard.
 *
 * Falls back to "closed" where visualViewport is unavailable, which is the
 * right default for a desktop browser with no on-screen keyboard.
 */
export function useKeyboardOpen(threshold = 140): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const check = () => {
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop
      setOpen(hidden > threshold)
    }

    check()
    viewport.addEventListener('resize', check)
    viewport.addEventListener('scroll', check)
    return () => {
      viewport.removeEventListener('resize', check)
      viewport.removeEventListener('scroll', check)
    }
  }, [threshold])

  return open
}
