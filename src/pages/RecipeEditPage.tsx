import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import NutritionGrid from '../components/NutritionGrid'
import Page from '../components/Page'
import SearchList, { type SearchItem } from '../components/SearchList'
import { perServing, recipeTotals, round, roundNutrients, scaleNutrients } from '../domain/nutrition'
import type { RecipeIngredient } from '../domain/types'
import { useAppState, useDispatch } from '../state/AppStore'
import { createRecipe } from '../state/factories'
import { foodsById } from '../state/selectors'

export default function RecipeEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { recipes, foods } = useAppState()

  const existing = id ? recipes.find((recipe) => recipe.id === id) : undefined
  const index = useMemo(() => foodsById(foods), [foods])

  const [name, setName] = useState(existing?.name ?? '')
  const [servings, setServings] = useState(String(existing?.servings ?? 1))
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    () => existing?.ingredients.map((ingredient) => ({ ...ingredient })) ?? [],
  )
  const [picking, setPicking] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const pickerItems = useMemo<SearchItem[]>(
    () =>
      [...foods]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((food) => ({
          id: food.id,
          name: food.brand ? `${food.name} · ${food.brand}` : food.name,
          detail: `${Math.round(food.per100g.kcal)} kcal per 100 g`,
          keywords: food.category ?? '',
          badge: food.source === 'user' ? 'Mine' : undefined,
        })),
    [foods],
  )

  if (id && !existing) {
    return (
      <Page title="Recipe not found" backTo="/recipes">
        <p className="muted">That recipe is no longer in your library.</p>
      </Page>
    )
  }

  const yieldCount = Math.max(1, Math.round(Number.parseFloat(servings) || 1))
  const totals = recipeTotals(ingredients, index)
  const single = perServing(totals, yieldCount)
  const canSave = name.trim() !== '' && ingredients.length > 0

  function addIngredient(foodId: string) {
    const food = index.get(foodId)
    setIngredients((current) => [
      ...current,
      { foodId, grams: food?.defaultServing?.grams ?? 100 },
    ])
    setPicking(false)
  }

  function updateGrams(position: number, value: string) {
    const grams = Number.parseFloat(value)
    setIngredients((current) =>
      current.map((ingredient, index_) =>
        index_ === position
          ? { ...ingredient, grams: Number.isFinite(grams) && grams >= 0 ? grams : 0 }
          : ingredient,
      ),
    )
  }

  function removeIngredient(position: number) {
    setIngredients((current) => current.filter((_, index_) => index_ !== position))
  }

  function save() {
    if (existing) {
      dispatch({
        type: 'recipe/update',
        recipe: { ...existing, name: name.trim(), servings: yieldCount, ingredients },
      })
    } else {
      dispatch({
        type: 'recipe/add',
        recipe: createRecipe({ name, servings: yieldCount, ingredients }),
      })
    }
    navigate('/recipes')
  }

  function remove() {
    if (!existing) return
    dispatch({ type: 'recipe/delete', id: existing.id })
    navigate('/recipes')
  }

  if (picking) {
    return (
      <Page title="Add ingredient" subtitle="Pick a food from your library">
        <SearchList
          items={pickerItems}
          onSelect={addIngredient}
          placeholder="Search your foods"
          autoFocus
        />
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setPicking(false)}>
            Cancel
          </Button>
        </div>
      </Page>
    )
  }

  return (
    <Page
      title={existing ? existing.name : 'New recipe'}
      subtitle="Totals update as you go"
      backTo="/recipes"
    >
      <section className="card mb-4 p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor="recipe-name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <input
              id="recipe-name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Chicken traybake"
            />
          </div>
          <div>
            <label htmlFor="recipe-servings" className="mb-1 block text-sm font-medium">
              Makes
            </label>
            <div className="relative">
              <input
                id="recipe-servings"
                className="field"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={servings}
                onChange={(event) => setServings(event.target.value)}
                onFocus={(event) => event.target.select()}
                style={{ paddingRight: '4.5rem' }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm muted">
                servings
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Ingredients</h2>
          <Button variant="secondary" onClick={() => setPicking(true)} className="px-3 py-1.5">
            Add
          </Button>
        </div>

        {ingredients.length === 0 ? (
          <p className="py-4 text-center text-sm muted">
            No ingredients yet. Add foods from your library to build this recipe.
          </p>
        ) : (
          <ul className="space-y-2">
            {ingredients.map((ingredient, position) => {
              const food = index.get(ingredient.foodId)
              const line = food ? roundNutrients(scaleNutrients(food.per100g, ingredient.grams)) : null
              return (
                <li
                  key={`${ingredient.foodId}-${position}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{ background: 'var(--track)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {food?.name ?? 'Deleted food'}
                      {food?.brand && <span className="muted"> · {food.brand}</span>}
                    </p>
                    <p className="truncate text-xs muted">
                      {line
                        ? `${line.kcal} kcal · C ${line.carbs}g · P ${line.protein}g · F ${line.fat}g`
                        : 'This food has been deleted and will not be counted.'}
                    </p>
                  </div>
                  <div className="relative w-24 shrink-0">
                    <input
                      className="field"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      aria-label={`Grams of ${food?.name ?? 'deleted food'}`}
                      value={String(ingredient.grams)}
                      onChange={(event) => updateGrams(position, event.target.value)}
                      onFocus={(event) => event.target.select()}
                      style={{ paddingRight: '1.75rem' }}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs muted">
                      g
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIngredient(position)}
                    aria-label={`Remove ${food?.name ?? 'ingredient'}`}
                    className="shrink-0 rounded-lg p-1.5 muted hover:text-[var(--color-over)]"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card mb-4 space-y-4 p-4">
        <NutritionGrid
          nutrients={single}
          caption={`Per serving · ${round(
            ingredients.reduce((total, ingredient) => total + ingredient.grams, 0) / yieldCount,
            0,
          )} g each`}
        />
        <NutritionGrid nutrients={totals} caption={`Whole recipe · ${yieldCount} servings`} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={!canSave}>
          {existing ? 'Save changes' : 'Create recipe'}
        </Button>
        {existing && !confirmingDelete && (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        )}
        {existing && confirmingDelete && (
          <>
            <span className="text-sm">Delete this recipe?</span>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </Page>
  )
}
