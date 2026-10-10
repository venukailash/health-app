import MacroBar from './MacroBar'
import { goalProgress } from '../state/selectors'
import type { Goals, Nutrients } from '../domain/types'

/**
 * What one meal contributed, measured against the whole day's targets.
 *
 * The denominator is the DAILY target, not the meal's share of what has been
 * eaten so far — the same yardstick as the dashboard above it, so "23%" means
 * the same thing wherever it appears. Reading breakfast as 23% of the day is
 * the useful fact; its share of a day that is only half eaten is not.
 */
export default function MealBreakdown({
  totals,
  goals,
}: {
  totals: Nutrients
  goals: Goals
}) {
  const progress = goalProgress(totals, goals)

  return (
    <div className="space-y-3.5 border-b px-4 py-4" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs muted">Share of your daily targets</p>
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
  )
}
