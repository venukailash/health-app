import { useState } from 'react'
import type { Serving } from '../domain/types'
import { round } from '../domain/nutrition'

/**
 * Amount for one recipe ingredient, in grams or in the food's own portions.
 *
 * Grams are always what gets stored — portions are a data-entry convenience,
 * so a food whose portion size is later corrected does not silently change
 * every recipe that used it. "2 slices" is easier to enter than "72 g", but
 * only the 72 g is a fact about the recipe.
 */
export default function IngredientAmount({
  grams,
  serving,
  label,
  onChange,
}: {
  grams: number
  serving?: Serving
  label: string
  onChange: (grams: number) => void
}) {
  const [unit, setUnit] = useState<'g' | 'serving'>('g')
  const usingServings = unit === 'serving' && serving !== undefined && serving.grams > 0

  const displayed = usingServings ? round(grams / (serving as Serving).grams, 2) : grams

  function commit(raw: string) {
    const parsed = Number.parseFloat(raw)
    const amount = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    onChange(usingServings ? round(amount * (serving as Serving).grams, 1) : amount)
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="relative w-20">
        <input
          className="field"
          type="number"
          inputMode="decimal"
          min={0}
          step={usingServings ? 0.25 : 1}
          aria-label={`Amount of ${label} in ${usingServings ? 'portions' : 'grams'}`}
          value={String(displayed)}
          onChange={(event) => commit(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
      </div>

      {serving && serving.grams > 0 ? (
        <select
          className="field w-auto px-1.5 py-1 text-xs"
          aria-label={`Unit for ${label}`}
          value={unit}
          onChange={(event) => setUnit(event.target.value as 'g' | 'serving')}
        >
          <option value="g">g</option>
          <option value="serving">{serving.label}</option>
        </select>
      ) : (
        <span className="w-6 text-xs muted">g</span>
      )}
    </div>
  )
}
