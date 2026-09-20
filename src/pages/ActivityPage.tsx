import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import NumberField from '../components/NumberField'
import Page from '../components/Page'
import PasteSteps from '../components/PasteSteps'
import ShortcutImport from '../components/ShortcutImport'
import StepsGoal from '../components/StepsGoal'
import { summariseSteps } from '../domain/activity'
import {
  addDays,
  dateRange,
  endOfMonth,
  endOfWeek,
  formatDayLabel,
  startOfMonth,
  startOfWeek,
  todayKey,
  weekdayShort,
} from '../domain/date'
import { useAppState, useDispatch } from '../state/AppStore'
import { useToast } from '../state/ToastProvider'

export default function ActivityPage() {
  const { activity, activityGoals, meta } = useAppState()
  const dispatch = useDispatch()
  const { showToast } = useToast()

  const today = todayKey()
  const [entryDate, setEntryDate] = useState(today)
  const [entrySteps, setEntrySteps] = useState('')

  const week = useMemo(
    () => summariseSteps(activity, dateRange(startOfWeek(today), endOfWeek(today)), activityGoals.steps),
    [activity, activityGoals.steps, today],
  )
  const month = useMemo(
    () => summariseSteps(activity, dateRange(startOfMonth(today), endOfMonth(today)), activityGoals.steps),
    [activity, activityGoals.steps, today],
  )

  const recent = useMemo(
    () => dateRange(addDays(today, -13), today).reverse(),
    [today],
  )

  const todaySteps = activity[today]?.steps ?? null
  const hasAny = Object.keys(activity).length > 0

  function saveManualEntry() {
    const steps = Number.parseInt(entrySteps, 10)
    if (!Number.isFinite(steps) || steps < 0) return
    dispatch({ type: 'activity/import', days: [{ date: entryDate, steps }], source: 'manual' })
    setEntrySteps('')
    showToast(`Saved ${steps.toLocaleString()} steps for ${formatDayLabel(entryDate, today)}.`, {
      tone: 'success',
    })
  }

  return (
    <Page
      title="Activity"
      subtitle="Steps against your daily target"
      action={
        <Link to="/activity/setup" className="text-sm font-semibold text-brand">
          Set up
        </Link>
      }
    >
      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-semibold">{formatDayLabel(today, today)}</h2>
        <StepsGoal steps={todaySteps} target={activityGoals.steps} />
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-semibold">This week and month</h2>
        <div className="space-y-4">
          <StepsGoal
            steps={week.recordedDays > 0 ? week.averageSteps : null}
            target={activityGoals.steps}
            label="Weekly average"
            caption={`${week.daysOnTarget} of ${week.recordedDays} recorded ${
              week.recordedDays === 1 ? 'day' : 'days'
            } hit the target · ${week.totalSteps.toLocaleString()} steps total`}
          />
          <StepsGoal
            steps={month.recordedDays > 0 ? month.averageSteps : null}
            target={activityGoals.steps}
            label="Monthly average"
            caption={`${month.daysOnTarget} of ${month.recordedDays} recorded ${
              month.recordedDays === 1 ? 'day' : 'days'
            } hit the target · ${month.totalSteps.toLocaleString()} steps total`}
          />
        </div>
        <p className="mt-3 text-xs muted">
          Averaged over days with a recorded count, not every day in the period.
        </p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Import from the Shortcut</h2>
        <p className="mb-4 text-sm muted">
          The clipboard is used rather than a link because an installed app has its own storage,
          separate from Safari&apos;s — a link from Shortcuts opens Safari and the numbers never
          reach this copy.{' '}
          <Link to="/activity/setup" className="font-medium text-brand">
            Set-up details
          </Link>
        </p>
        <ShortcutImport
          shortcutName={meta.shortcutName}
          onImport={(days) => {
            dispatch({ type: 'activity/import', days, source: 'shortcut' })
            showToast(`Imported ${days.length} ${days.length === 1 ? 'day' : 'days'} of steps.`, {
              tone: 'success',
            })
          }}
          onMessage={(message, tone) => showToast(message, { tone })}
        />

        <PasteSteps
          onImport={(days) => {
            dispatch({ type: 'activity/import', days, source: 'shortcut' })
            showToast(`Imported ${days.length} ${days.length === 1 ? 'day' : 'days'} of steps.`, {
              tone: 'success',
            })
          }}
        />
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Add a count by hand</h2>
        <p className="mb-4 text-sm muted">
          Useful for backfilling, or if you would rather not set up the Shortcut.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="activity-date" className="mb-1 block text-sm font-medium">
              Date
            </label>
            <input
              id="activity-date"
              className="field"
              type="date"
              max={today}
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
            />
          </div>
          <NumberField label="Steps" value={entrySteps} onChange={setEntrySteps} step="100" />
          <Button onClick={saveManualEntry} disabled={entrySteps.trim() === ''}>
            Save
          </Button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b px-4 py-3 font-semibold" style={{ borderColor: 'var(--border)' }}>
          Last 14 days
        </h2>
        {!hasAny ? (
          <EmptyState
            title="No step counts yet"
            description="Set up the iOS Shortcut to bring them across from Apple Health, or add a count by hand above."
            action={
              <Link to="/activity/setup" className="text-sm font-semibold text-brand">
                How to set it up
              </Link>
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recent.map((date) => {
              const day = activity[date]
              const met = day && activityGoals.steps > 0 && day.steps >= activityGoals.steps
              return (
                <li
                  key={date}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-medium">{weekdayShort(date)}</span>
                    <span className="text-xs muted">{formatDayLabel(date, today)}</span>
                  </span>
                  {day ? (
                    <span className="flex items-center gap-3">
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: met ? 'var(--color-steps)' : undefined }}
                      >
                        {day.steps.toLocaleString()}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide muted">
                        {day.source === 'shortcut' ? 'Health' : 'Manual'}
                      </span>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'activity/delete', date })}
                        aria-label={`Remove steps for ${date}`}
                        className="rounded-lg p-1 muted hover:text-[var(--color-over)]"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </span>
                  ) : (
                    <span className="text-sm muted">—</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Page>
  )
}
