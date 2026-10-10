import { useState } from 'react'
import Button from './Button'
import NutritionGrid from './NutritionGrid'
import { MissingKeyError, ModelError, estimateRecipeFromText, type RecipeEstimate } from '../services/gemini'
import { DEFAULT_GEMINI_MODEL } from '../services/gemini'
import { LookupFailedError, RateLimitedError } from '../services/openFoodFacts'
import { useAppState } from '../state/AppStore'
import { findMatchingFood } from '../domain/matchFood'
import { perServing, round, scaleNutrients, sumNutrients } from '../domain/nutrition'

const EXAMPLES = [
  '28g coffee beans in a moka pot + 200g whole milk, serves 2',
  '2 eggs scrambled with 10g butter and a slice of wholemeal toast',
  '400g chicken breast, 300g rice, 200g broccoli — makes 3 portions',
]

const CONFIDENCE_NOTE: Record<RecipeEstimate['confidence'], string> = {
  low: 'Low confidence — check the weights and figures before saving.',
  medium: 'Medium confidence — worth a look over.',
  high: 'High confidence, but still an estimate.',
}

/**
 * Build a recipe from a sentence.
 *
 * Ingredients are matched against the food library first: a described "whole
 * milk" should reuse the curated starter food rather than add a near-duplicate
 * carrying a model's guess. The review step shows which were matched and which
 * are new, because that is the difference between a trusted figure and an
 * estimated one.
 */
export default function RecipePrompt({
  onAccept,
  onCancel,
}: {
  onAccept: (estimate: RecipeEstimate) => void
  onCancel: () => void
}) {
  const { meta, foods } = useAppState()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<RecipeEstimate | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setEstimate(null)
    try {
      const result = await estimateRecipeFromText(text, {
        apiKey: meta.geminiApiKey,
        model: meta.geminiModel || DEFAULT_GEMINI_MODEL,
      })
      setEstimate(result)
    } catch (caught) {
      if (
        caught instanceof MissingKeyError ||
        caught instanceof ModelError ||
        caught instanceof LookupFailedError
      ) {
        setError(caught.message)
      } else if (caught instanceof RateLimitedError) {
        setError('Gemini is rate limiting. Try again in a minute.')
      } else {
        setError('Something went wrong reading that description.')
      }
    } finally {
      setBusy(false)
    }
  }

  const matched = estimate?.ingredients.map((ingredient) => ({
    ingredient,
    existing: findMatchingFood(ingredient.name, foods),
  }))

  const totals = matched
    ? sumNutrients(
        matched.map(({ ingredient, existing }) =>
          scaleNutrients(existing ? existing.per100g : ingredient.per100g, ingredient.grams),
        ),
      )
    : null

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="mb-1 font-semibold">Describe the recipe</h2>
        <p className="mb-3 text-sm muted">
          Write it the way you would say it, including weights and how many it serves. Gemini turns
          it into ingredients for you to check.
        </p>

        <textarea
          className="field"
          rows={3}
          placeholder={EXAMPLES[0]}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="rounded-full px-2.5 py-1 text-left text-xs muted hover:text-brand"
              style={{ background: 'var(--track)' }}
            >
              {example.length > 44 ? `${example.slice(0, 44)}…` : example}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void run()} disabled={busy || text.trim() === ''}>
            {busy ? 'Working it out…' : 'Work out the ingredients'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-over)' }}>
            {error}
          </p>
        )}
      </section>

      {estimate && matched && totals && (
        <section className="card p-4">
          <h3 className="font-semibold">{estimate.name}</h3>
          <p className="mt-1 text-sm muted">
            Makes {estimate.servings} {estimate.servings === 1 ? 'serving' : 'servings'} ·{' '}
            {CONFIDENCE_NOTE[estimate.confidence]}
          </p>
          {estimate.caveat && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-over)' }}>
              {estimate.caveat}
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {matched.map(({ ingredient, existing }, index) => (
              <li
                key={`${ingredient.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                style={{ background: 'var(--track)' }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {existing ? existing.name : ingredient.name}
                  </span>
                  <span className="block text-xs muted">
                    {existing
                      ? 'already in your foods — its own figures will be used'
                      : 'new food, from an estimate'}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {round(ingredient.grams, 0)} g
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <NutritionGrid
              nutrients={perServing(totals, estimate.servings)}
              caption="Per serving"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onAccept(estimate)}>Use this recipe</Button>
            <Button variant="secondary" onClick={() => void run()} disabled={busy}>
              Try again
            </Button>
          </div>
          <p className="mt-3 text-xs muted">
            Nothing is saved yet — you can change every weight on the next screen.
          </p>
        </section>
      )}
    </div>
  )
}
