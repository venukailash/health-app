import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import CalendarHeatmap from '../components/CalendarHeatmap'
import EmptyState from '../components/EmptyState'
import MacroBar from '../components/MacroBar'
import Page from '../components/Page'
import PeriodSwitcher from '../components/PeriodSwitcher'
import StatTile from '../components/StatTile'
import StepsGoal from '../components/StepsGoal'
import { summariseSteps } from '../domain/activity'
import {
  addMonths,
  endOfMonth,
  formatMonthLabel,
  formatMonthTitle,
  isSameMonth,
  isValidDateKey,
  startOfMonth,
  todayKey,
} from '../domain/date'
import { percentOfGoal, round } from '../domain/nutrition'
import { useAppState } from '../state/AppStore'
import { goalProgress, rangeStats } from '../state/selectors'

export default function MonthPage() {
  const { date } = useParams()
  const state = useAppState()
  const [showTable, setShowTable] = useState(false)

  const valid = Boolean(date && isValidDateKey(date))
  const from = valid ? startOfMonth(date as string) : ''
  const to = valid ? endOfMonth(date as string) : ''

  const stats = useMemo(
    () => (valid ? rangeStats(state, from, to) : null),
    [state, from, to, valid],
  )
  const summaries = useMemo(
    () => new Map((stats?.days ?? []).map((day) => [day.date, day])),
    [stats],
  )

  if (!valid || !stats) return <Navigate to={`/month/${todayKey()}`} replace />

  const today = todayKey()
  const progress = goalProgress(stats.averages, state.goals)
  const loggedDays = stats.days.filter((day) => day.logged)
  const steps = summariseSteps(
    state.activity,
    stats.days.map((day) => day.date),
    state.activityGoals.steps,
  )

  return (
    <Page
      title={formatMonthTitle(date as string, today)}
      subtitle={formatMonthLabel(date as string)}
      action={
        isSameMonth(date as string, today) ? undefined : (
          <Link to={`/month/${today}`} className="text-sm font-semibold text-brand">
            This month
          </Link>
        )
      }
    >
      <PeriodSwitcher active="month" date={date as string} />

      <nav aria-label="Change month" className="mb-4 flex items-center justify-between gap-2">
        <Link
          to={`/month/${addMonths(from, -1)}`}
          className="card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          ← {formatMonthLabel(addMonths(from, -1)).split(' ')[0]}
        </Link>
        <Link
          to={`/month/${addMonths(from, 1)}`}
          className="card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          {formatMonthLabel(addMonths(from, 1)).split(' ')[0]} →
        </Link>
      </nav>

      <section className="card mb-4 p-4">
        <CalendarHeatmap
          month={from}
          summaries={summaries}
          goal={state.goals.kcal}
          today={today}
        />
      </section>

      {stats.loggedDays === 0 ? (
        <EmptyState
          title="Nothing logged this month"
          description="Days you log will fill in on the calendar above."
          action={
            <Link to={`/day/${today}`} className="text-sm font-semibold text-brand">
              Go to today
            </Link>
          }
        />
      ) : (
        <>
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
              {stats.loggedDays === 1 ? 'day' : 'days'} you logged this month.
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
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="font-semibold">Logged days</h2>
              <button
                type="button"
                onClick={() => setShowTable((value) => !value)}
                aria-expanded={showTable}
                className="text-sm font-semibold text-brand"
              >
                {showTable ? 'Hide table' : 'Show table'}
              </button>
            </div>

            {showTable ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left muted">
                      <th scope="col" className="px-4 py-2 font-medium">Date</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">kcal</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">% goal</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">C</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">P</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loggedDays.map((day) => (
                      <tr key={day.date} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <th scope="row" className="px-4 py-2 text-left font-normal">
                          <Link to={`/day/${day.date}`} className="hover:text-brand">
                            {day.date}
                          </Link>
                        </th>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Math.round(day.totals.kcal)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {percentOfGoal(day.totals.kcal, state.goals.kcal)}%
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {round(day.totals.carbs, 0)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {round(day.totals.protein, 0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {round(day.totals.fat, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 text-sm muted">
                {stats.loggedDays} {stats.loggedDays === 1 ? 'day' : 'days'} logged this month.
                Tap any square on the calendar to open that day.
              </p>
            )}
          </section>
        </>
      )}
    </Page>
  )
}
