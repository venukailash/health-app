import { Link, Navigate, useParams } from 'react-router-dom'
import DailyColumns from '../components/DailyColumns'
import EmptyState from '../components/EmptyState'
import MacroBar from '../components/MacroBar'
import Page from '../components/Page'
import PeriodSwitcher from '../components/PeriodSwitcher'
import StatTile from '../components/StatTile'
import StepsGoal from '../components/StepsGoal'
import { summariseSteps } from '../domain/activity'
import {
  addWeeks,
  endOfWeek,
  formatWeekLabel,
  formatWeekRange,
  isValidDateKey,
  startOfWeek,
  todayKey,
  weekdayShort,
} from '../domain/date'
import { round } from '../domain/nutrition'
import { useAppState } from '../state/AppStore'
import { goalProgress, rangeStats } from '../state/selectors'

export default function WeekPage() {
  const { date } = useParams()
  const state = useAppState()

  if (!date || !isValidDateKey(date)) return <Navigate to={`/week/${todayKey()}`} replace />

  const today = todayKey()
  const from = startOfWeek(date)
  const to = endOfWeek(date)
  const stats = rangeStats(state, from, to)
  const progress = goalProgress(stats.averages, state.goals)
  const steps = summariseSteps(
    state.activity,
    stats.days.map((day) => day.date),
    state.activityGoals.steps,
  )

  return (
    <Page
      title={formatWeekLabel(date, today)}
      subtitle={formatWeekRange(date)}
      action={
        startOfWeek(today) === from ? undefined : (
          <Link to={`/week/${today}`} className="text-sm font-semibold text-brand">
            This week
          </Link>
        )
      }
    >
      <PeriodSwitcher active="week" date={date} />

      <nav aria-label="Change week" className="mb-4 flex items-center justify-between gap-2">
        <Link
          to={`/week/${addWeeks(from, -1)}`}
          className="card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          ← Previous
        </Link>
        <Link
          to={`/week/${addWeeks(from, 1)}`}
          className="card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          Next →
        </Link>
      </nav>

      {stats.loggedDays === 0 ? (
        <EmptyState
          title="Nothing logged this week"
          description="Log a meal on any day and it will show up here."
          action={
            <Link to={`/day/${today}`} className="text-sm font-semibold text-brand">
              Go to today
            </Link>
          }
        />
      ) : (
        <>
          <section className="card mb-4 p-4">
            <DailyColumns
              days={stats.days}
              goal={state.goals.kcal}
              caption="Calories per day"
            />
          </section>

          <section className="card mb-4 p-4">
            <dl className="mb-5 grid grid-cols-3 gap-2">
              <StatTile
                label="Daily average"
                value={Math.round(stats.averages.kcal)}
                detail="kcal"
              />
              <StatTile
                label="Days logged"
                value={`${stats.loggedDays}/${stats.totalDays}`}
                detail={stats.bestStreak > 1 ? `best run ${stats.bestStreak}` : undefined}
              />
              <StatTile
                label="On target"
                value={`${stats.daysOnTarget}/${stats.loggedDays}`}
                detail="days at or under"
              />
            </dl>

            <h2 className="mb-1 text-sm font-semibold">Average day</h2>
            <p className="mb-4 text-sm muted">
              Averaged over the {stats.loggedDays}{' '}
              {stats.loggedDays === 1 ? 'day' : 'days'} you logged, not all{' '}
              {stats.totalDays} — blank days would drag these down.
            </p>

            <div className="space-y-3.5">
              <MacroBar label="Carbs" progress={progress.carbs} color="var(--color-carbs)" />
              <MacroBar label="Fibre" progress={progress.fibre} color="var(--color-fibre)" />
              <MacroBar label="Protein" progress={progress.protein} color="var(--color-protein)" />
              <MacroBar label="Fat" progress={progress.fat} color="var(--color-fat)" />
              <MacroBar
                label="of which saturates"
                progress={progress.satFat}
                color="var(--color-satfat)"
                indent
              />
              <MacroBar label="Salt" progress={progress.salt} color="var(--color-salt)" />

              <div className="border-t pt-3.5" style={{ borderColor: 'var(--border)' }}>
                <StepsGoal
                  steps={steps.recordedDays > 0 ? steps.averageSteps : null}
                  target={state.activityGoals.steps}
                  label="Steps"
                  caption={`${steps.daysOnTarget} of ${steps.recordedDays} recorded ${
                    steps.recordedDays === 1 ? 'day' : 'days'
                  } hit the target`}
                />
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b px-4 py-3 font-semibold" style={{ borderColor: 'var(--border)' }}>
              Day by day
            </h2>
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {stats.days.map((day) => (
                <li key={day.date} style={{ borderColor: 'var(--border)' }}>
                  <Link
                    to={`/day/${day.date}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-[var(--track)]"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium">{weekdayShort(day.date)}</span>
                      {day.date === today && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                          Today
                        </span>
                      )}
                    </span>
                    {day.logged ? (
                      <span className="text-sm tabular-nums muted">
                        C {round(day.totals.carbs, 0)}g · P {round(day.totals.protein, 0)}g · F{' '}
                        {round(day.totals.fat, 0)}g
                        <span className="ml-2 font-semibold text-[var(--text)]">
                          {Math.round(day.totals.kcal)} kcal
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm muted">Not logged</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Page>
  )
}
