import { Link, useLocation } from 'react-router-dom'
import { useKeyboardOpen } from '../hooks/useKeyboardOpen'

/**
 * Floating shortcut straight to the photo estimator.
 *
 * Shown only on the top-level screens. Anywhere deeper — an editor, the
 * scanner, the estimator itself — the user is already mid-task and a floating
 * button over the form is in the way rather than a shortcut.
 */
const TOP_LEVEL = [
  // Anchored to the end on purpose: /day/<date> is a top-level screen, but
  // /day/<date>/add/<meal> is a form the button would sit on top of.
  /^\/day\/[^/]+$/,
  /^\/week\/[^/]+$/,
  /^\/month\/[^/]+$/,
  /^\/foods$/,
  /^\/recipes$/,
]

export default function QuickAddButton() {
  const { pathname } = useLocation()
  // Hide behind the on-screen keyboard, as the nav bar does.
  const keyboardOpen = useKeyboardOpen()

  if (keyboardOpen || !TOP_LEVEL.some((pattern) => pattern.test(pathname))) return null

  return (
    <Link
      to="/foods/new?ai=photo"
      aria-label="Add a food with Gemini"
      data-tour="quick-add"
      className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg transition-transform hover:scale-105 active:scale-95"
      style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
    >
      {/* Sparkles, not a camera: the button opens the whole assist, where a
          photo is one of two ways in. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="currentColor">
        <path d="M12 2.5l1.6 4.6a4 4 0 0 0 2.5 2.5l4.6 1.6-4.6 1.6a4 4 0 0 0-2.5 2.5L12 20l-1.6-4.7a4 4 0 0 0-2.5-2.5L3.2 11.2l4.7-1.6a4 4 0 0 0 2.5-2.5z" />
        <path d="M18.5 16.5l.65 1.85a1.6 1.6 0 0 0 1 1L22 20l-1.85.65a1.6 1.6 0 0 0-1 1L18.5 23.5l-.65-1.85a1.6 1.6 0 0 0-1-1L15 20l1.85-.65a1.6 1.6 0 0 0 1-1z" />
      </svg>
    </Link>
  )
}
