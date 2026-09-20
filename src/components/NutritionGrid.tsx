import { roundNutrients } from '../domain/nutrition'
import type { Nutrients } from '../domain/types'

/** Compact six-up readout of a set of totals. */
export default function NutritionGrid({
  nutrients,
  caption,
}: {
  nutrients: Nutrients
  caption?: string
}) {
  const value = roundNutrients(nutrients)
  const cells: [string, string | number][] = [
    ['kcal', value.kcal],
    ['Carbs', `${value.carbs} g`],
    ['Fibre', `${value.fibre} g`],
    ['Protein', `${value.protein} g`],
    ['Fat', `${value.fat} g`],
    ['Sat fat', `${value.satFat} g`],
    ['Salt', `${value.salt} g`],
  ]

  return (
    <div>
      {caption && <p className="mb-2 text-sm font-medium muted">{caption}</p>}
      <dl className="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-7">
        {cells.map(([label, cell]) => (
          <div key={label} className="rounded-xl px-2 py-2" style={{ background: 'var(--track)' }}>
            <dt className="text-xs muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{cell}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
