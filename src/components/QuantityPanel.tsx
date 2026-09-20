import { useState } from 'react'
import Button from './Button'
import NutritionGrid from './NutritionGrid'
import { ZERO_NUTRIENTS, multiplyNutrients, scaleNutrients } from '../domain/nutrition'
import type { Food, Nutrients, Recipe } from '../domain/types'

/** What a quantity is being entered against: a food in grams, or a recipe in servings. */
export type QuantityTarget = { kind: 'food'; food: Food } | { kind: 'recipe'; recipe: Recipe }

/**
 * Quantity step shared by the add and edit flows: grams for a food,
 * servings for a recipe, with a live preview of what will be logged.
 */
export default function QuantityPanel({
  target,
  perServing,
  initialQuantity,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  target: QuantityTarget
  /** Nutrition for one serving, required for recipes. */
  perServing?: Nutrients
  initialQuantity: number
  confirmLabel: string
  onConfirm: (quantity: number, nutrients: Nutrients) => void
  onCancel: () => void
}) {
  const [quantity, setQuantity] = useState(String(initialQuantity))

  const parsed = Number.parseFloat(quantity)
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

  const nutrients =
    target.kind === 'food'
      ? scaleNutrients(target.food.per100g, amount)
      : multiplyNutrients(perServing ?? ZERO_NUTRIENTS, amount)

  const unit = target.kind === 'food' ? 'g' : amount === 1 ? 'serving' : 'servings'
  const shortcuts =
    target.kind === 'food'
      ? [
          ...(target.food.defaultServing
            ? [{ label: target.food.defaultServing.label, value: target.food.defaultServing.grams }]
            : []),
          { label: '50 g', value: 50 },
          { label: '100 g', value: 100 },
          { label: '150 g', value: 150 },
          { label: '200 g', value: 200 },
        ]
      : [
          { label: '½', value: 0.5 },
          { label: '1', value: 1 },
          { label: '1½', value: 1.5 },
          { label: '2', value: 2 },
        ]

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <p className="font-medium">
          {target.kind === 'food' ? target.food.name : target.recipe.name}
        </p>
        <p className="text-sm muted">
          {target.kind === 'food'
            ? `${Math.round(target.food.per100g.kcal)} kcal per 100 g`
            : `Makes ${target.recipe.servings} ${
                target.recipe.servings === 1 ? 'serving' : 'servings'
              }`}
        </p>

        <div className="mt-4">
          <label htmlFor="quantity" className="mb-1 block text-sm font-medium">
            {target.kind === 'food' ? 'How much?' : 'How many servings?'}
          </label>
          <div className="relative">
            <input
              id="quantity"
              className="field text-lg font-semibold tabular-nums"
              type="number"
              inputMode="decimal"
              min={0}
              step={target.kind === 'food' ? 1 : 0.25}
              value={quantity}
              autoFocus
              onChange={(event) => setQuantity(event.target.value)}
              onFocus={(event) => event.target.select()}
              style={{ paddingRight: '5rem' }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm muted">
              {unit}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => setQuantity(String(shortcut.value))}
                className="rounded-full px-3 py-1.5 text-sm font-medium hover:text-brand"
                style={{ background: 'var(--track)' }}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <NutritionGrid nutrients={nutrients} caption="This adds" />
      </section>

      <div className="flex items-center gap-2">
        <Button onClick={() => onConfirm(amount, nutrients)} disabled={amount <= 0}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
