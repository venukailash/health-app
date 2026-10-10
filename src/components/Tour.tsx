import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from './Button'
import { todayKey } from '../domain/date'
import { TOUR_REVISION, stepsFor, type TourStepId } from '../domain/tour'
import { useAppState, useDispatch } from '../state/AppStore'

/**
 * The welcome tour: five cards, Next and Back, and Skip on every one of them.
 *
 * It is a stepped sheet rather than spotlights on the real controls. The five
 * things worth saying live on four different screens, so a spotlight tour
 * would have to drive the router around and would break the moment a layout
 * moved. This says where everything is and gets out of the way.
 */

const CONTENT: Record<TourStepId, { title: string; body: ReactNode }> = {
  install: {
    title: 'Keep it on your home screen',
    body: (
      <>
        <p>
          This is a web app with no server behind it, so installing it is how you get an icon, a
          full screen, and meals you can log with no signal.
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>iPhone or iPad:</strong> open it in Safari, tap Share, then{' '}
            <strong>Add to Home Screen</strong>.
          </li>
          <li>
            <strong>Android:</strong> Chrome offers <strong>Install app</strong> in its menu.
          </li>
        </ul>
        <p className="rounded-lg px-3 py-2" style={{ background: 'var(--track)' }}>
          <strong>Worth knowing:</strong> on iPhone the installed app gets its own private
          storage. Anything you logged in Safari first will not appear in it. If you have already
          started, export a backup from Settings and import it once, then stick to the installed
          one.
        </p>
      </>
    ),
  },
  keys: {
    title: 'Two optional keys, both free',
    body: (
      <>
        <p>
          Everything works without them. They are in <strong>Settings → App</strong>, and both
          are stored on this device only — never in a backup, never sent anywhere but to the
          service itself.
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>FoodData Central</strong> makes food search faster and lifts the shared demo
            limit of about ten searches an hour.
          </li>
          <li>
            <strong>Google Gemini</strong> unlocks working out nutrition from a photo or a
            description.
          </li>
        </ul>
      </>
    ),
  },
  ai: {
    title: 'Photograph it, or just describe it',
    body: (
      <>
        <p>
          The <strong>sparkle button</strong> at the bottom right, and the same option inside a
          new food or recipe, will estimate nutrition two ways:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Photo</strong> — camera or library, up to four shots of the same thing. A
            second angle showing the size of the container makes the portion much better.
          </li>
          <li>
            <strong>Describe</strong> — “28 g of coffee in a moka pot with 200 g whole milk,
            serves 2” is enough to build a recipe.
          </li>
        </ul>
        <p>
          You can add a note to a photo before sending it. Nothing is ever saved straight from an
          estimate: it fills the editor and you check it first.
        </p>
      </>
    ),
  },
  targets: {
    title: 'Set what you are aiming for',
    body: (
      <>
        <p>
          <strong>Settings → Targets</strong> holds your daily calories, carbs, fibre, protein,
          fat, saturated fat and salt. Sensible defaults are already in there.
        </p>
        <p>
          Every percentage in the app is measured against these — the ring, the bars, and each
          meal’s share of the day.
        </p>
      </>
    ),
  },
  log: {
    title: 'Logging a meal',
    body: (
      <>
        <p>
          On the day screen, tap <strong>+ Add to breakfast</strong> (or lunch, dinner, snacks)
          and then either:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>search the food library and your own recipes,</li>
          <li>scan a barcode, or type the number off the packet, or</li>
          <li>use the sparkle button for a photo.</li>
        </ul>
        <p>
          Set the amount in grams, or by the portion if the food has one. Tap a meal heading to
          see what it contributed to your day.
        </p>
      </>
    ),
  },
}

export default function Tour() {
  const state = useAppState()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  const steps = stepsFor(state.meta.tourSeenRevision)
  const open = steps.length > 0

  function finish(goToToday = false) {
    dispatch({
      type: 'meta/set',
      meta: { ...state.meta, tourSeenRevision: TOUR_REVISION },
    })
    if (goToToday) navigate(`/day/${todayKey()}`)
  }

  // Held in a ref so the Escape handler below is registered once and still
  // writes the CURRENT meta: re-registering on every render would be noise,
  // and capturing meta once would let Escape undo a theme change made while
  // the tour was open.
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finishRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    // The sheet scrolls on its own; the page behind it must not.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const step = steps[Math.min(index, steps.length - 1)]
  const content = CONTENT[step.id]
  const last = index >= steps.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="card flex max-h-[88vh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-2xl"
      >
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide muted">
            {state.meta.tourSeenRevision === undefined ? 'Welcome' : "What's new"} · {index + 1} of{' '}
            {steps.length}
          </p>
          <button
            type="button"
            onClick={() => finish()}
            className="rounded-lg px-2 py-1 text-sm font-semibold muted hover:text-brand"
          >
            Skip
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
          <h2 id="tour-title" className="text-lg font-semibold">
            {content.title}
          </h2>
          {content.body}
        </div>

        <footer
          className="flex items-center gap-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--border)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {steps.map((dot, dotIndex) => (
              <span
                key={dot.id}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: dotIndex === index ? 'var(--color-brand)' : 'var(--border)',
                }}
              />
            ))}
          </div>

          {index > 0 && (
            <Button variant="ghost" onClick={() => setIndex((current) => current - 1)}>
              Back
            </Button>
          )}
          {last ? (
            <Button onClick={() => finish(true)}>Start logging</Button>
          ) : (
            <Button onClick={() => setIndex((current) => current + 1)}>Next</Button>
          )}
        </footer>
      </div>
    </div>
  )
}
