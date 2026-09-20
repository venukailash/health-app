import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import { parseStepsPayload, type ParseResult } from '../domain/activity'
import { useDispatch } from '../state/AppStore'
import { useStandalone } from '../hooks/useStandalone'
import { useToast } from '../state/ToastProvider'

/**
 * Landing point for the iOS Shortcut.
 *
 *   #/activity/import?days=2026-09-20:8421,2026-09-19:10233
 *
 * Imports on arrival and bounces back to Activity, so the Shortcut's only job
 * is to open a URL. It reports what it rejected rather than silently dropping
 * rows — a Shortcut sending the wrong Health type is the likely failure, and
 * silently importing nothing would be impossible to debug.
 */
export default function ActivityImportPage() {
  const [params] = useSearchParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [result, setResult] = useState<ParseResult | null>(null)
  const standalone = useStandalone()
  const done = useRef(false)

  const payload = params.get('days') ?? params.get('steps')
  const single = params.get('date')

  useEffect(() => {
    if (done.current) return
    done.current = true

    // `?steps=8421&date=2026-09-20` is the simplest thing to build in
    // Shortcuts, so accept it as well as the batch form.
    const normalised =
      payload && single && !payload.includes(':') ? `${single}:${payload}` : payload

    const parsed = parseStepsPayload(normalised)
    setResult(parsed)

    if (parsed.days.length > 0) {
      dispatch({ type: 'activity/import', days: parsed.days, source: 'shortcut' })
      const total = parsed.days.reduce((sum, day) => sum + day.steps, 0)
      showToast(
        parsed.days.length === 1
          ? `Imported ${total.toLocaleString()} steps.`
          : `Imported ${parsed.days.length} days of steps.`,
        { tone: 'success' },
      )
    }
  }, [payload, single, dispatch, showToast])

  // Redirect lives in its own effect. Folding it into the import effect meant
  // the once-only guard swallowed it: StrictMode runs the effect, the cleanup
  // cancels the timer, and the second run returns early before rescheduling.
  useEffect(() => {
    if (!result || result.days.length === 0) return
    // Straight back to Activity; the Shortcut only had to open the URL.
    const timer = setTimeout(() => navigate('/activity', { replace: true }), 900)
    return () => clearTimeout(timer)
  }, [result, navigate])

  const nothingUsable = result !== null && result.days.length === 0

  return (
    <Page title="Importing steps" backTo="/activity">
      {!standalone && (
        <section
          className="card mb-4 p-4"
          style={{ borderLeft: '3px solid var(--color-over)' }}
        >
          <h2 className="mb-1 font-semibold">This is the browser copy of the app</h2>
          <p className="text-sm muted">
            If you normally use the app from your Home Screen, these steps have gone into Safari
            instead, and the installed app will not show them — iOS keeps the two entirely
            separate. Open the installed app and use{' '}
            <strong>Import from the Shortcut</strong> there, pasting the link or the counts.
          </p>
        </section>
      )}

      {result === null ? (
        <p className="card p-4 text-sm muted">Reading the data…</p>
      ) : nothingUsable ? (
        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Nothing could be imported</h2>
          <p className="mb-3 text-sm muted">
            {result.rejected.length === 0
              ? 'The link carried no step data at all.'
              : 'The link was read, but none of the entries were usable:'}
          </p>
          {result.rejected.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {result.rejected.slice(0, 6).map((entry, index) => (
                <li key={index} className="tabular-nums">
                  <code className="muted">{entry.raw.slice(0, 40)}</code> — {entry.reason}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm muted">
            The expected format is{' '}
            <code>#/activity/import?days=YYYY-MM-DD:1234</code>, with days separated by commas.
          </p>
          <div className="mt-4 flex gap-3">
            <Link to="/activity/setup" className="text-sm font-semibold text-brand">
              Check the setup
            </Link>
            <Link to="/activity" className="text-sm font-semibold muted">
              Back to Activity
            </Link>
          </div>
        </section>
      ) : (
        <section className="card p-4">
          <p className="font-medium">
            Imported {result.days.length} {result.days.length === 1 ? 'day' : 'days'}.
          </p>
          {result.rejected.length > 0 && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-over)' }}>
              {result.rejected.length}{' '}
              {result.rejected.length === 1 ? 'entry was' : 'entries were'} skipped.
            </p>
          )}
        </section>
      )}
    </Page>
  )
}
