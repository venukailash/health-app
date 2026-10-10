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
      aria-label="Add a food from a photo"
      className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <circle cx="12" cy="12.5" r="3.5" />
      </svg>
    </Link>
  )
}
