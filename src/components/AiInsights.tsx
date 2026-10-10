import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import { formatFullDate, formatMonthLabel, formatWeekRange, todayKey } from '../domain/date'
import { canGenerate, insightKey, type Insight, type InsightScope } from '../domain/insights'
import {
  DEFAULT_GEMINI_MODEL,
  geminiErrorMessage,
  readInsights,
} from '../services/gemini'
import { useAppState, useDispatch } from '../state/AppStore'
import { buildInsightInput, hasEnoughToRead, periodKeyFor } from '../state/insightInput'

const SCOPE_NOUN: Record<InsightScope, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
}

const NOT_ENOUGH: Record<InsightScope, string> = {
  day: 'Log breakfast, lunch and dinner, and I can read this day against your targets.',
  week: 'Log a day this week and I can read it against your targets.',
  month: 'Log a day this month and I can read it against your targets.',
}

/**
 * "AI insights" — one reading of a day, week or month against the targets.
 *
 * Asked for once per period per calendar day, and kept. Re-opening shows what
 * came back before rather than spending another request on a question whose
 * answer has not changed; a finished day is therefore read exactly once, and a
 * period still in progress can be looked at again tomorrow.
 *
 * It lives in the middle of the day/week/month navigation row and is a button
 * and nothing else. A row of its own, with a line underneath explaining why it
 * was greyed out, pushed the calorie ring off the bottom of a small screen —
 * so the reason moved inside the panel, where it costs no height and is read
 * at the moment someone goes looking for it.
 */
export default function AiInsights({ scope, date }: { scope: InsightScope; date: string }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const today = todayKey()
  const periodKey = periodKeyFor(scope, date)
  const key = insightKey(scope, periodKey)
  const stored: Insight | undefined = state.insights[key]
  const enough = hasEnoughToRead(state, scope, date)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const reply = await readInsights(buildInsightInput(state, scope, date), {
        apiKey: state.meta.geminiApiKey,
        model: state.meta.geminiModel || DEFAULT_GEMINI_MODEL,
      })
      dispatch({
        type: 'insight/save',
        key,
        insight: { scope, periodKey, generatedOn: today, ...reply },
      })
    } catch (caught) {
      setError(geminiErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function openPanel() {
    setOpen(true)
    setError(null)
    // Nothing stored yet means this is the first look, so fetch it now rather
    // than showing an empty panel with a button in it. Too little logged means
    // say so — and never spend a request to be told the same.
    if (!stored && enough) void run()
  }

  const label =
    scope === 'day'
      ? formatFullDate(periodKey)
      : scope === 'week'
        ? formatWeekRange(periodKey)
        : formatMonthLabel(periodKey)

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={enough ? 'AI insights' : `AI insights — ${NOT_ENOUGH[scope]}`}
        // Never shrinks and never truncates: it is the fixed point the two
        // steps are arranged around.
        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80 ${
          enough ? 'text-brand' : 'muted'
        }`}
        style={{
          /*
           * A two-stop border in the theme's own accent and chart hue, over a
           * faint wash of the same accent — so it reads as the one thing in
           * the row that does something, in whichever theme is on.
           *
           * The border is a gradient, which a plain `border-color` cannot be:
           * the first layer paints the inside, the second the edge, and the
           * clips keep them apart. Every colour is a token, so all four
           * themes and both modes are covered by themes.test.ts.
           */
          border: '1px solid transparent',
          backgroundImage:
            'linear-gradient(var(--brand-wash), var(--brand-wash)), linear-gradient(120deg, var(--color-brand), var(--color-kcal))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="currentColor">
          <path d="M12 2.5l1.6 4.6a4 4 0 0 0 2.5 2.5l4.6 1.6-4.6 1.6a4 4 0 0 0-2.5 2.5L12 20l-1.6-4.7a4 4 0 0 0-2.5-2.5L3.2 11.2l4.7-1.6a4 4 0 0 0 2.5-2.5z" />
        </svg>
        <span>Insights</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div
            aria-hidden="true"
            className="fixed inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.55)' }}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="insights-title"
            className="card relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-2xl"
          >
            <header
              className="flex items-center justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="min-w-0">
                <h2 id="insights-title" className="truncate font-semibold">
                  AI insights
                </h2>
                <p className="truncate text-xs muted">{label}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-semibold muted hover:text-brand"
              >
                Close
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {busy && <p className="text-sm muted">Reading your {SCOPE_NOUN[scope]}…</p>}

              {!enough && !stored && !busy && <p className="text-sm">{NOT_ENOUGH[scope]}</p>}

              {error && (
                <p className="text-sm" style={{ color: 'var(--color-over)' }}>
                  {error}
                </p>
              )}

              {stored && !busy && (
                <>
                  <p className="text-base font-semibold">{stored.headline}</p>

                  {stored.points.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {stored.points.map((point) => (
                        <li key={point} className="flex gap-2">
                          <span aria-hidden="true" className="text-brand">
                            •
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {stored.advice.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">What might help</h3>
                      <ul className="space-y-2 text-sm">
                        {stored.advice.map((item) => (
                          <li
                            key={item}
                            className="rounded-xl px-3 py-2"
                            style={{ background: 'var(--track)' }}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {stored.caveat && (
                    <p className="text-sm" style={{ color: 'var(--color-over)' }}>
                      {stored.caveat}
                    </p>
                  )}

                  <p className="text-xs muted">
                    Worked out on {formatFullDate(stored.generatedOn)} from your totals and
                    targets. An estimate from a language model, not medical advice.
                  </p>
                </>
              )}
            </div>

            <footer
              className="flex items-center justify-between gap-2 border-t px-4 py-3"
              style={{
                borderColor: 'var(--border)',
                paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
              }}
            >
              <p className="text-xs muted">
                {stored && !canGenerate(stored, today)
                  ? 'One reading a day — come back tomorrow for a fresh one.'
                  : 'One reading per day.'}
              </p>
              {stored && canGenerate(stored, today) && (
                <Button variant="ghost" onClick={() => void run()} disabled={busy}>
                  Read it again
                </Button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
