import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from './Button'
import { todayKey } from '../domain/date'
import { TOUR_REVISION, stepsFor, tourRoute, type TourStep, type TourStepId } from '../domain/tour'
import { useSpotlight } from '../hooks/useSpotlight'
import { useAppState, useDispatch } from '../state/AppStore'

/**
 * The welcome tour: five cards, Next and Back, and Skip on every one of them.
 *
 * A card that names a route drives the router there, and a card that names an
 * anchor cuts a hole in the dimming over the real control — so "the Gemini key
 * is in Settings" becomes the actual box, on the actual screen, with a ring
 * round it.
 *
 * Pointing at things that may not be there is the whole difficulty. The anchor
 * is missing while the route is still changing, and stays missing if a layout
 * drops it. `useSpotlight` returns null in both cases and this falls back to a
 * plain centred card, so the worst outcome is the tour that existed before.
 * `Tour.anchors.test.tsx` is what stops an anchor quietly disappearing.
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
  foodKey: {
    title: 'A food search key, if you want one',
    body: (
      <>
        <p>
          Search works without it, on a demo key shared with everyone else, which runs out after
          about ten searches an hour. Your own is free and instant from{' '}
          <strong>fdc.nal.usda.gov</strong> and raises that to a thousand.
        </p>
        <p>Paste it into the box behind this card and tap Save key. Barcode scanning needs none.</p>
      </>
    ),
  },
  geminiKey: {
    title: 'And a Gemini key, for the photo feature',
    body: (
      <>
        <p>
          This one unlocks working out nutrition from a photo or a description. Free keys come
          from <strong>aistudio.google.com/apikey</strong>.
        </p>
        <p className="rounded-lg px-3 py-2" style={{ background: 'var(--track)' }}>
          Both keys are stored on this device only. They are left out of backups, and go nowhere
          except to the service they belong to. Use keys made only for this, and set a spending
          cap on the Google one.
        </p>
      </>
    ),
  },
  ai: {
    title: 'Photograph it, or just describe it',
    body: (
      <>
        <p>
          The <strong>sparkle button</strong> highlighted here, and the same option inside a new
          food or recipe, will estimate nutrition two ways:
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
          This is <strong>Settings → Targets</strong>: your daily calories, carbs, fibre,
          protein, fat, saturated fat and salt. Sensible defaults are already in there.
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
          This is the one for breakfast; each meal has its own. Tap it, then either:
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
  const location = useLocation()
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
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const step: TourStep | undefined = open ? steps[Math.min(index, steps.length - 1)] : undefined
  const wanted = step && tourRoute(step, todayKey())

  // Drive the router to the screen the card is about. `replace` so stepping
  // through the tour does not leave five entries in the back history.
  useEffect(() => {
    if (wanted && location.pathname !== wanted) navigate(wanted, { replace: true })
  }, [wanted, location.pathname, navigate])

  const onRoute = !wanted || location.pathname === wanted
  const rect = useSpotlight(step?.anchor, open && onRoute)

  if (!open || !step) return null

  const content = CONTENT[step.id]
  const last = index >= steps.length - 1
  // With a hole cut in the dimming, the card takes whichever side of it has
  // more room left: measuring the gaps beats guessing from the midpoint,
  // which put the card on top of anything tall.
  const roomAbove = rect ? rect.top : 0
  const roomBelow = rect ? window.innerHeight - (rect.top + rect.height) : 0
  const cardAtTop = rect !== null && roomAbove > roomBelow

  return (
    <div className="fixed inset-0 z-50">
      {/* The dimming. With a spotlight it is an enormous shadow around the
          hole, which is one element and no clipping; without one it is a
          plain sheet over everything. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            outline: '2px solid var(--color-brand)',
            outlineOffset: 0,
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0" style={{ background: 'rgba(0, 0, 0, 0.55)' }} />
      )}

      {/* Catches everything aimed at the app underneath. The tour is reading,
          not doing: tapping the highlighted control would navigate away from
          the card that is explaining it. */}
      <div className="fixed inset-0" onClick={(event) => event.preventDefault()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={`card fixed inset-x-0 mx-auto flex max-h-[70vh] w-full max-w-lg flex-col sm:inset-x-4 ${
          cardAtTop ? 'top-0 rounded-t-none sm:top-4 sm:rounded-t-2xl' : 'bottom-0 rounded-b-none sm:bottom-4 sm:rounded-b-2xl'
        }`}
        style={cardAtTop ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
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
