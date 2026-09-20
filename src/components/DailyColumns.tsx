import { useState } from 'react'
import { Link } from 'react-router-dom'
import { weekdayShort } from '../domain/date'
import type { DaySummary } from '../state/selectors'

const PLOT_HEIGHT = 168

/**
 * Daily calories across a range, as columns against a goal reference line.
 *
 * One series, so no legend — the caption names what is plotted. Over-goal days
 * are shown by position (the column clears the goal line) rather than by a
 * second colour, which keeps the chart to a single hue. Values are not printed
 * on every column; the tallest is labelled and the rest are in the tooltip and
 * the day list beneath.
 */
export default function DailyColumns({
  days,
  goal,
  caption,
}: {
  days: DaySummary[]
  goal: number
  caption: string
}) {
  const [active, setActive] = useState<number | null>(null)

  const peak = Math.max(...days.map((day) => day.totals.kcal), goal, 1)
  // Headroom so the tallest column and the goal line never touch the top edge.
  const scaleMax = peak * 1.15
  const toPercent = (value: number) => (value / scaleMax) * 100

  const peakIndex = days.reduce(
    (best, day, index) => (day.totals.kcal > days[best].totals.kcal ? index : best),
    0,
  )
  const anyLogged = days.some((day) => day.logged)

  return (
    <figure className="m-0">
      <figcaption className="mb-3 text-sm muted">{caption}</figcaption>

      <div className="relative" style={{ height: PLOT_HEIGHT }}>
        {/* Recessive hairline grid: solid, one step off the surface. */}
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <div
            key={fraction}
            aria-hidden="true"
            className="absolute inset-x-0 h-px"
            style={{ bottom: `${fraction * 100}%`, background: 'var(--border)' }}
          />
        ))}

        {goal > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 flex items-center"
            style={{ bottom: `${toPercent(goal)}%` }}
          >
            <div className="h-px flex-1" style={{ background: 'var(--text-muted)' }} />
            <span className="pl-1.5 text-[10px] font-medium muted">goal</span>
          </div>
        )}

        <div className="absolute inset-0 flex items-end">
          {days.map((day, index) => {
            const height = day.logged ? Math.max(toPercent(day.totals.kcal), 1.5) : 0
            return (
              <div
                key={day.date}
                className="relative flex h-full flex-1 items-end justify-center"
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
              >
                <Link
                  to={`/day/${day.date}`}
                  // The whole band is the hit target, not just the column.
                  className="flex h-full w-full items-end justify-center rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
                  aria-label={
                    day.logged
                      ? `${weekdayShort(day.date)} ${day.date}: ${Math.round(day.totals.kcal)} kilocalories`
                      : `${weekdayShort(day.date)} ${day.date}: nothing logged`
                  }
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  {day.logged ? (
                    <span
                      className="w-full max-w-6 transition-[height] duration-500"
                      style={{
                        height: `${height}%`,
                        background: 'var(--color-kcal)',
                        // Rounded data-end, square at the baseline.
                        borderRadius: '4px 4px 0 0',
                        opacity: active === null || active === index ? 1 : 0.55,
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mb-1 h-1 w-full max-w-6 rounded-full"
                      style={{ background: 'var(--track)' }}
                    />
                  )}
                </Link>

                {/* Direct-label the peak only; the rest live in the tooltip and list. */}
                {anyLogged && index === peakIndex && day.logged && active === null && (
                  <span
                    className="pointer-events-none absolute text-[11px] font-semibold tabular-nums"
                    style={{ bottom: `calc(${height}% + 4px)` }}
                  >
                    {Math.round(day.totals.kcal)}
                  </span>
                )}

                {active === index && (
                  <div
                    role="tooltip"
                    className="card pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap px-2 py-1 text-xs shadow-lg"
                  >
                    <span className="font-semibold">{weekdayShort(day.date)}</span>{' '}
                    {day.logged ? (
                      <span className="tabular-nums">{Math.round(day.totals.kcal)} kcal</span>
                    ) : (
                      <span className="muted">not logged</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-1.5 flex">
        {days.map((day) => (
          <div key={day.date} className="flex-1 text-center text-[11px] muted">
            {weekdayShort(day.date).slice(0, 3)}
          </div>
        ))}
      </div>
    </figure>
  )
}
