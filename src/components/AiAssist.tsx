import { useRef, useState } from 'react'
import Button from './Button'
import NutritionGrid from './NutritionGrid'
import {
  DEFAULT_GEMINI_MODEL,
  MAX_PHOTOS,
  estimateFood,
  estimateRecipe,
  geminiErrorMessage,
  type FoodEstimate,
  type RecipeEstimate,
} from '../services/gemini'
import { useAppState } from '../state/AppStore'
import { useHasCamera } from '../hooks/useHasCamera'
import { findMatchingFood } from '../domain/matchFood'
import { perServing, round, scaleNutrients, sumNutrients } from '../domain/nutrition'

export type AiMode = 'photo' | 'describe'
export type AiTarget = 'food' | 'recipe'

const EXAMPLES: Record<AiTarget, string[]> = {
  food: ['a flat white with oat milk', '2 slices of sourdough toast with butter'],
  recipe: [
    '28g coffee beans in a moka pot + 200g whole milk, serves 2',
    '400g chicken breast, 300g rice, 200g broccoli — makes 3 portions',
  ],
}

const CONFIDENCE_NOTE = {
  low: 'Low confidence — treat these as a rough starting point and correct them.',
  medium: 'Medium confidence — worth checking.',
  high: 'High confidence, but still an estimate.',
} as const

/**
 * The single way to get nutrition out of Gemini, used by every entry point.
 *
 * Two inputs (photo, description) and two targets (one food, a recipe), kept
 * as separate choices so each entry point can offer the same two options in
 * the same order. Previously photo lived only on foods and description only on
 * recipes, under three different labels, which made the app feel like it had
 * several half-features rather than one.
 *
 * Nothing is saved from here. The estimate is handed back for the editor to
 * fill in, where every figure stays editable.
 */
export default function AiAssist({
  target,
  initialMode = 'photo',
  onAcceptFood,
  onAcceptRecipe,
  onCancel,
}: {
  target: AiTarget
  initialMode?: AiMode
  onAcceptFood?: (estimate: FoodEstimate) => void
  onAcceptRecipe?: (estimate: RecipeEstimate) => void
  onCancel: () => void
}) {
  const { meta, foods } = useAppState()
  // Two inputs, because one cannot do both: `capture` opens the camera on a
  // phone and is ignored on desktop, and an input without it opens the photo
  // library rather than the camera.
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const hasCamera = useHasCamera()

  const [mode, setMode] = useState<AiMode>(initialMode)
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [food, setFood] = useState<FoodEstimate | null>(null)
  const [recipe, setRecipe] = useState<RecipeEstimate | null>(null)

  const options = { apiKey: meta.geminiApiKey, model: meta.geminiModel || DEFAULT_GEMINI_MODEL }

  function reset() {
    setError(null)
    setFood(null)
    setRecipe(null)
  }

  async function run(input: { photos?: File[]; text?: string }) {
    setBusy(true)
    reset()
    try {
      if (target === 'food') setFood(await estimateFood(input, options))
      else setRecipe(await estimateRecipe(input, options))
    } catch (caught) {
      setError(geminiErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Choosing a photo no longer sends it.
   *
   * It used to go straight to Gemini, which left no room to say the thing that
   * would have made the answer right — "cooked in two tablespoons of oil",
   * "this is a half portion". Several photos can be added too: a second shot of
   * the container or a hand beside the plate is often what makes the portion
   * judgeable at all. The note and the extra shots are both optional.
   */
  function addPhotos(files: File[]) {
    setPhotos((current) =>
      [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(
        0,
        MAX_PHOTOS,
      ),
    )
    reset()
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].preview)
      return current.filter((_, position) => position !== index)
    })
    reset()
  }

  const ready = mode === 'photo' ? photos.length > 0 : text.trim() !== ''

  // Recipe ingredients that already exist keep their own curated figures.
  const matched = recipe?.ingredients.map((ingredient) => ({
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
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) addPhotos([file])
          event.target.value = ''
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          addPhotos([...(event.target.files ?? [])])
          event.target.value = ''
        }}
      />

      <section className="card p-4">
        {/* Photo first, description second — the same order everywhere. */}
        <div
          className="mb-4 flex gap-1 rounded-xl p-1"
          style={{ background: 'var(--track)' }}
          role="tablist"
          aria-label="How to describe it"
        >
          {(
            [
              ['photo', 'Photo'],
              ['describe', 'Describe'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value)
                reset()
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === value ? 'text-brand' : 'muted'
              }`}
              style={mode === value ? { background: 'var(--surface-raised)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'photo' ? (
          <>
            <p className="mb-3 text-sm muted">
              {target === 'food'
                ? 'Photograph the food or its label.'
                : 'Photograph the meal and its parts will be listed as ingredients.'}
            </p>
            {photos.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {photos.map((item, index) => (
                  <div key={item.preview} className="relative">
                    <img
                      src={item.preview}
                      alt={`Photo ${index + 1} of ${photos.length}`}
                      className="h-28 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute right-1 top-1 rounded-full p-1 text-white"
                      style={{ background: 'rgba(0,0,0,0.55)' }}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <div className="flex flex-wrap gap-2">
                {/* Camera first, deliberately: it is what people want on a phone. */}
                {hasCamera && (
                  <Button
                    variant={photos.length > 0 ? 'secondary' : 'primary'}
                    onClick={() => cameraInput.current?.click()}
                    disabled={busy}
                  >
                    {photos.length > 0 ? 'Add another photo' : 'Take a photo'}
                  </Button>
                )}
                <Button
                  variant={hasCamera || photos.length > 0 ? 'secondary' : 'primary'}
                  onClick={() => libraryInput.current?.click()}
                  disabled={busy}
                >
                  {photos.length > 0 ? 'Add from photos' : 'Choose a photo'}
                </Button>
              </div>
            )}

            {photos.length >= MAX_PHOTOS && (
              <p className="text-sm muted">
                {MAX_PHOTOS} photos is the most that helps — remove one to swap it.
              </p>
            )}

            {photos.length > 0 && (
              <div className="mt-4">
                <label htmlFor="photo-note" className="mb-1 block text-sm font-medium">
                  Anything else that would help? <span className="muted">(optional)</span>
                </label>
                <textarea
                  id="photo-note"
                  className="field"
                  rows={2}
                  placeholder={
                    target === 'food'
                      ? 'e.g. fried in a tablespoon of olive oil, the glass is 8cm tall'
                      : 'e.g. the rice is 200g cooked, serves 3'
                  }
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
                <p className="mt-1 text-xs muted">
                  A photo cannot show how something was cooked, and scale is hard to judge from
                  one. Say so here, or add a second shot with something for scale in it.
                </p>
                <div className="mt-3">
                  <Button
                    onClick={() => void run({ photos: photos.map((item) => item.file), text })}
                    disabled={busy}
                  >
                    {busy ? 'Working it out…' : food || recipe ? 'Work it out again' : 'Work it out'}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm muted">
              Write it the way you would say it, including weights
              {target === 'recipe' ? ' and how many it serves' : ''}.
            </p>
            <textarea
              className="field"
              rows={3}
              placeholder={EXAMPLES[target][0]}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES[target].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full px-2.5 py-1 text-left text-xs muted hover:text-brand"
                  style={{ background: 'var(--track)' }}
                >
                  {example.length > 42 ? `${example.slice(0, 42)}…` : example}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Button onClick={() => void run({ text })} disabled={busy || !ready}>
                {busy ? 'Working it out…' : 'Work it out'}
              </Button>
            </div>
          </>
        )}

        <div className="mt-3">
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

      {food && (
        <section className="card p-4">
          <h3 className="font-semibold">{food.name}</h3>
          <p className="mt-1 text-sm muted">{CONFIDENCE_NOTE[food.confidence]}</p>
          {food.caveat && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-over)' }}>
              {food.caveat}
            </p>
          )}
          <div className="mt-4">
            <NutritionGrid nutrients={food.per100g} caption="Estimated per 100 g" />
          </div>
          {food.defaultServing && (
            <p className="mt-3 text-sm muted">
              A normal portion is about{' '}
              <strong className="text-[var(--text)]">{round(food.defaultServing.grams, 0)} g</strong>{' '}
              ({food.defaultServing.label}).
            </p>
          )}
          <div className="mt-4">
            <Button onClick={() => onAcceptFood?.(food)}>Use these figures</Button>
          </div>
          <p className="mt-3 text-xs muted">
            Nothing is saved yet — every number stays editable on the next screen.
          </p>
        </section>
      )}

      {recipe && matched && totals && (
        <section className="card p-4">
          <h3 className="font-semibold">{recipe.name}</h3>
          <p className="mt-1 text-sm muted">
            Makes {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'} ·{' '}
            {CONFIDENCE_NOTE[recipe.confidence]}
          </p>
          {recipe.caveat && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-over)' }}>
              {recipe.caveat}
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
                <span className="shrink-0 text-sm tabular-nums">{round(ingredient.grams, 0)} g</span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <NutritionGrid nutrients={perServing(totals, recipe.servings)} caption="Per serving" />
          </div>

          <div className="mt-4">
            <Button onClick={() => onAcceptRecipe?.(recipe)}>Use this recipe</Button>
          </div>
          <p className="mt-3 text-xs muted">
            Nothing is saved yet — every weight stays editable on the next screen.
          </p>
        </section>
      )}
    </div>
  )
}
