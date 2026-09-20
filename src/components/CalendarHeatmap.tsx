import { Link } from 'react-router-dom'
import { fromDateKey, isSameMonth, monthGrid, weekdayInitials } from '../domain/date'
import { percentOfGoal } from '../domain/nutrition'
import type { DaySummary } from '../state/selectors'

/**
 * Sequential ramp steps, light to dark. One hue; magnitude is lightness.
 *
 * The bands are weighted towards the top of the range because that is where
 * real days land — an evenly-spaced 25/50/75 split put almost every day in the
 * same two shades and the map stopped saying anything.
 */
const STEPS = [
  { upTo: 50, token: 'var(--heat-1)', label: 'up to half your goal' },
  { upTo: 75, token: 'var(--heat-2)', label: 'half to three quarters' },
  { upTo: 100, token: 'var(--heat-3)', label: 'three quarters to goal' },
  { upTo: Number.POSITIVE_INFINITY, token: 'var(--heat-4)', label: 'at or over goal' },
]

export function stepFor(percent: number): (typeof STEPS)[number] {
  return STEPS.find((step) => percent <= step.upTo) ?? STEPS[STEPS.length - 1]
}

/**
 * A month of days, shaded by how much of the calorie goal was eaten.
 *
 * Sequential: a single hue, light to dark, so the shade only ever means
 * "how much". Going over goal is a separate, reserved state and is marked with
 * a ring plus a dot — never a second hue — so the ramp keeps one meaning.
 * Every cell is a link whose accessible name carries the underlying numbers,
 * so nothing is reachable by colour alone.
 */
export default function CalendarHeatmap({
  month,
  summaries,
  goal,
  today,
}: {
  month: string
  summaries: Map<string, DaySummary>
  goal: number
  today: string
}) {
  const grid = monthGrid(month)
  const initials = weekdayInitials()

  return (
    <figure className="m-0">
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {initials.map((initial, index) => (
          <div key={index} className="text-center text-[11px] font-medium muted">
            {initial}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {grid.flat().map((date) => {
          const inMonth = isSameMonth(date, month)
          const summary = summaries.get(date)
          const logged = summary?.logged ?? false
          const kcal = summary?.totals.kcal ?? 0
          const percent = percentOfGoal(kcal, goal)
          const over = goal > 0 && kcal > goal
          const dayNumber = fromDateKey(date).getDate()

          if (!inMonth) {
            return <div key={date} aria-hidden="true" className="aspect-square" />
          }

          return (
            <Link
              key={date}
              to={`/day/${date}`}
              aria-label={
                logged
                  ? `${date}: ${Math.round(kcal)} kilocalories, ${percent}% of goal${over ? ', over goal' : ''}`
                  : `${date}: nothing logged`
              }
              className="relative flex aspect-square items-center justify-center rounded-lg text-xs font-medium tabular-nums outline-offset-2 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
              style={{
                background: logged ? stepFor(percent).token : 'var(--track)',
                // Darker steps need light text; empty and pale cells keep ink.
                color: logged && percent > 50 ? 'white' : 'var(--text)',
                // Inset, so the marker never crowds the neighbouring cells the
                // way an outer ring did once several days in a row ran over.
                boxShadow: over ? 'inset 0 0 0 2px var(--color-over)' : undefined,
                outline: date === today ? '2px dashed var(--text-muted)' : undefined,
                outlineOffset: date === today ? '1px' : undefined,
              }}
            >
              {dayNumber}
              {over && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--color-over)' }}
                />
              )}
            </Link>
          )
        })}
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] muted">
        <span className="flex items-center gap-1.5">
          <span>Less</span>
          {STEPS.map((step) => (
            <span
              key={step.label}
              title={step.label}
              className="inline-block h-3 w-3 rounded"
              style={{ background: step.token }}
            />
          ))}
          <span>More of goal</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded"
            style={{ background: 'var(--track)' }}
          />
          Not logged
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded"
            style={{ background: 'var(--heat-4)', boxShadow: 'inset 0 0 0 2px var(--color-over)' }}
          />
          Over goal
        </span>
      </figcaption>
    </figure>
  )
}
