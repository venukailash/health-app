import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import Page from '../components/Page'
import MealBreakdown from '../components/MealBreakdown'
import PeriodSwitcher from '../components/PeriodSwitcher'
import { addDays, formatDayLabel, formatFullDate, isValidDateKey, todayKey } from '../domain/date'
import { percentOfGoal, round, roundNutrients } from '../domain/nutrition'
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '../domain/types'
import { useAppState, useDispatch } from '../state/AppStore'
import { dayTotals, entriesForDate, fatBreakdown, goalProgress, totalsFor } from '../state/selectors'

export default function TodayPage() {
  const { date } = useParams()
  const state = useAppState()
  const dispatch = useDispatch()
  // Collapsed by default: the breakdown is for when a number looks wrong, not
  // something to scroll past four times on the way to adding lunch.
  const [expanded, setExpanded] = useState<MealType[]>([])
  // Removing a logged entry takes two taps: the first arms the row, the second
  // does it. A mis-tap on a phone otherwise costs you the whole entry and the
  // search that found it.
  const [armedForRemoval, setArmedForRemoval] = useState<string | null>(null)

  // An armed row disarms itself, so a stray tap never leaves a live destructive
  // control sitting under your thumb.
  useEffect(() => {
    if (!armedForRemoval) return
    const timer = setTimeout(() => setArmedForRemoval(null), 4000)
    return () => clearTimeout(timer)
  }, [armedForRemoval])

  if (!date || !isValidDateKey(date)) {
    return <Navigate to={`/day/${todayKey()}`} replace />
  }

  const today = todayKey()
  const entries = entriesForDate(state, date)
  const totals = dayTotals(state, date)
  const progress = goalProgress(totals, state.goals)
  const fat = fatBreakdown(totals)

  return (
    <Page
      title={formatDayLabel(date, today)}
      subtitle={formatFullDate(date)}
      action={
        date === today ? undefined : (
          <Link to={`/day/${today}`} className="text-sm font-semibold text-brand">
            Today
          </Link>
        )
      }
    >
      <PeriodSwitcher active="day" date={date} />

      <nav aria-label="Change day" className="mb-4 flex items-center justify-between gap-2">
        <Link
          to={`/day/${addDays(date, -1)}`}
          className="card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          ← {formatDayLabel(addDays(date, -1), today)}
        </Link>
        <Link
          to={`/day/${addDays(date, 1)}`}
          className="card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          {formatDayLabel(addDays(date, 1), today)} →
        </Link>
      </nav>

      <section className="card mb-4 p-4">
        <CalorieRing consumed={totals.kcal} target={state.goals.kcal} />

        <div className="mt-6 space-y-3.5">
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
        </div>

        {fat.total > 0 && (
          <p className="mt-4 text-sm muted">
            Of {round(fat.total)} g fat today, {round(fat.saturated)} g is saturated (
            {fat.saturatedShare}%) and {round(fat.unsaturated)} g unsaturated.
          </p>
        )}
      </section>

      <div className="space-y-4">
        {MEAL_TYPES.map((meal) => {
          const mealEntries = entries.filter((entry) => entry.meal === meal)
          const rawTotal = totalsFor(mealEntries)
          const mealTotal = roundNutrients(rawTotal)
          const isOpen = expanded.includes(meal)
          const hasEntries = mealEntries.length > 0
          const sharePercent = percentOfGoal(rawTotal.kcal, state.goals.kcal)

          return (
            <section key={meal} className="card overflow-hidden">
              {hasEntries ? (
                <h2>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((current) =>
                        current.includes(meal)
                          ? current.filter((value) => value !== meal)
                          : [...current, meal],
                      )
                    }
                    className="flex w-full items-baseline justify-between gap-3 border-b px-4 py-3 text-left hover:bg-[var(--track)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="font-semibold">{MEAL_LABELS[meal]}</span>
                    <span className="flex items-baseline gap-2 text-sm tabular-nums muted">
                      <span>{mealTotal.kcal} kcal</span>
                      <span className="font-medium text-[var(--text)]">{sharePercent}%</span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className={`h-4 w-4 self-center transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                </h2>
              ) : (
                <header
                  className="flex items-baseline justify-between gap-3 border-b px-4 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <h2 className="font-semibold">{MEAL_LABELS[meal]}</h2>
                  <p className="text-sm tabular-nums muted">—</p>
                </header>
              )}

              {hasEntries && isOpen && <MealBreakdown totals={rawTotal} goals={state.goals} />}

              {mealEntries.length > 0 && (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {mealEntries.map((entry) => {
                    const value = roundNutrients(entry.nutrients)
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-2"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <Link
                          to={`/day/${date}/entry/${entry.id}`}
                          className="min-w-0 flex-1 px-4 py-3 hover:bg-[var(--track)]"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate font-medium">{entry.label}</p>
                            <p className="shrink-0 text-sm font-semibold tabular-nums">
                              {value.kcal} kcal
                            </p>
                          </div>
                          <p className="truncate text-xs muted">
                            {entry.ref.kind === 'food'
                              ? `${round(entry.ref.grams, 0)} g`
                              : `${round(entry.ref.servings, 2)} ${
                                  entry.ref.servings === 1 ? 'serving' : 'servings'
                                }`}{' '}
                            · C {value.carbs}g · P {value.protein}g · F {value.fat}g · Salt{' '}
                            {value.salt}g
                          </p>
                        </Link>
                        {armedForRemoval === entry.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              dispatch({ type: 'entry/delete', date, id: entry.id })
                              setArmedForRemoval(null)
                            }}
                            aria-label={`Confirm removing ${entry.label}`}
                            className="mr-2 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-over)]"
                          >
                            Remove?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setArmedForRemoval(entry.id)}
                            aria-label={`Remove ${entry.label}`}
                            className="mr-2 shrink-0 rounded-lg p-2 muted hover:text-[var(--color-over)]"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              <Link
                to={`/day/${date}/add/${meal}`}
                className="block px-4 py-3 text-sm font-semibold text-brand hover:bg-[var(--track)]"
              >
                + Add to {MEAL_LABELS[meal].toLowerCase()}
              </Link>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
