import { useState } from 'react'
import Button from './Button'
import NutritionGrid from './NutritionGrid'
import { ZERO_NUTRIENTS, multiplyNutrients, round, scaleNutrients } from '../domain/nutrition'
import type { Food, Nutrients, Recipe, Serving } from '../domain/types'

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
  const serving = target.kind === 'food' ? target.food.defaultServing : undefined
  const canCount = serving !== undefined && serving.grams > 0

  /**
   * Default to counting portions when the food has one. Someone logging eggs
   * means "2 eggs", not "2 grams" — and a plain grams box silently logged the
   * latter.
   */
  const [mode, setMode] = useState<'grams' | 'portions'>(canCount ? 'portions' : 'grams')
  const [quantity, setQuantity] = useState(() =>
    String(canCount ? round(initialQuantity / (serving as Serving).grams, 2) : initialQuantity),
  )

  const parsed = Number.parseFloat(quantity)
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

  // Grams are what gets stored, whichever way the number was entered.
  const grams =
    target.kind === 'food' && mode === 'portions' && canCount
      ? amount * (serving as Serving).grams
      : amount

  const nutrients =
    target.kind === 'food'
      ? scaleNutrients(target.food.per100g, grams)
      : multiplyNutrients(perServing ?? ZERO_NUTRIENTS, amount)

  /** Switch units without changing how much food is being logged. */
  function switchMode(next: 'grams' | 'portions') {
    if (!canCount || next === mode) return
    const servingGrams = (serving as Serving).grams
    setQuantity(String(next === 'portions' ? round(grams / servingGrams, 2) : round(grams, 1)))
    setMode(next)
  }

  const portionWord = serving ? serving.label : 'portion'

  const unit =
    target.kind === 'recipe'
      ? amount === 1
        ? 'serving'
        : 'servings'
      : mode === 'portions'
        ? amount === 1
          ? portionWord
          : `× ${portionWord}`
        : 'g'

  const shortcuts =
    target.kind === 'recipe'
      ? [
          { label: '½', value: 0.5 },
          { label: '1', value: 1 },
          { label: '1½', value: 1.5 },
          { label: '2', value: 2 },
        ]
      : mode === 'portions'
        ? [
            { label: '½', value: 0.5 },
            { label: '1', value: 1 },
            { label: '2', value: 2 },
            { label: '3', value: 3 },
            { label: '4', value: 4 },
          ]
        : [
            { label: '50 g', value: 50 },
            { label: '100 g', value: 100 },
            { label: '150 g', value: 150 },
            { label: '200 g', value: 200 },
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

        {canCount && target.kind === 'food' && (
          <div
            className="mt-4 flex gap-1 rounded-xl p-1"
            style={{ background: 'var(--track)' }}
            role="tablist"
            aria-label="Enter amount as"
          >
            {([
              ['portions', `Count (${serving?.label})`],
              ['grams', 'Weight (g)'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                  mode === value ? 'text-brand' : 'muted'
                }`}
                style={mode === value ? { background: 'var(--surface-raised)' } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="quantity" className="mb-1 block text-sm font-medium">
            {target.kind === 'recipe'
              ? 'How many servings?'
              : mode === 'portions'
                ? `How many? (${serving?.label})`
                : 'How much?'}
          </label>
          <div className="relative">
            <input
              id="quantity"
              className="field text-lg font-semibold tabular-nums"
              type="number"
              inputMode="decimal"
              min={0}
              step={target.kind === 'food' && mode === 'grams' ? 1 : 0.25}
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
        <NutritionGrid
          nutrients={nutrients}
          caption={
            target.kind === 'food' && mode === 'portions' && amount > 0
              ? `This adds · ${round(grams, 1)} g`
              : 'This adds'
          }
        />
      </section>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => onConfirm(target.kind === 'food' ? grams : amount, nutrients)}
          disabled={amount <= 0}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
