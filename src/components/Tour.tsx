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
    title: 'Put it on your home screen',
    body: (
      <>
        <p>
          <strong>iPhone:</strong> Share → Add to Home Screen. <strong>Android:</strong> Chrome’s
          menu → Install app. You get an icon, a full screen, and it works with no signal.
        </p>
        <p className="rounded-lg px-3 py-2" style={{ background: 'var(--track)' }}>
          On iPhone the installed app has its own separate storage. Anything logged in Safari
          first will not be in it.
        </p>
      </>
    ),
  },
  foodKey: {
    title: 'Food search key',
    body: (
      <p>
        Optional. Without one, search shares a demo key good for about ten an hour. Your own is
        free from <strong>fdc.nal.usda.gov</strong> and raises that to a thousand.
      </p>
    ),
  },
  geminiKey: {
    title: 'Gemini key',
    body: (
      <p>
        Optional, and what unlocks working nutrition out from a photo. Free from{' '}
        <strong>aistudio.google.com/apikey</strong>. Both keys stay on this device and are left
        out of backups.
      </p>
    ),
  },
  ai: {
    title: 'Photo, or just describe it',
    body: (
      <p>
        This button estimates nutrition from up to four photos, or from words — “28 g coffee in a
        moka pot with 200 g whole milk, serves 2”. You always check it before it is saved.
      </p>
    ),
  },
  targets: {
    title: 'Your daily targets',
    body: (
      <p>
        Calories and each macro, with sensible defaults already set. Every percentage in the app
        is measured against these.
      </p>
    ),
  },
  log: {
    title: 'Logging a meal',
    body: (
      <p>
        Tap this to add to breakfast; each meal has its own. Search, scan a barcode, or use the
        sparkle button. Tap a meal heading to see what it contributed.
      </p>
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
  const ring = useRef<HTMLDivElement>(null)
  const { visible, cardAtTop } = useSpotlight(step?.anchor, open && onRoute, ring)

  if (!open || !step) return null

  const content = CONTENT[step.id]
  const last = index >= steps.length - 1

  return (
    <div className="fixed inset-0 z-50">
      {/* The dimming. The ring is always mounted so the hook has something to
          position before the first paint; when there is nothing to point at
          it is simply hidden and a plain sheet covers everything instead. */}
      <div
        ref={ring}
        aria-hidden="true"
        className="pointer-events-none fixed rounded-xl"
        style={{
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          outline: '2px solid var(--color-brand)',
          display: visible ? undefined : 'none',
        }}
      />
      {!visible && (
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
        className={`card fixed inset-x-0 mx-auto flex max-h-[52vh] w-full max-w-lg flex-col sm:inset-x-4 ${
          cardAtTop ? 'top-0 rounded-t-none sm:top-4 sm:rounded-t-2xl' : 'bottom-0 rounded-b-none sm:bottom-4 sm:rounded-b-2xl'
        }`}
        style={cardAtTop ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
      >
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-2"
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

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
          <h2 id="tour-title" className="text-base font-semibold">
            {content.title}
          </h2>
          {content.body}
        </div>

        <footer
          className="flex items-center gap-2 border-t px-4 py-2"
          style={{ borderColor: 'var(--border)', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
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
