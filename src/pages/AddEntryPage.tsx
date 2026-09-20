import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import QuantityPanel from '../components/QuantityPanel'
import SearchList, { type SearchItem } from '../components/SearchList'
import { formatDayLabel, isValidDateKey, todayKey } from '../domain/date'
import { recipePerServing, roundNutrients } from '../domain/nutrition'
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '../domain/types'
import { useAppState, useDispatch } from '../state/AppStore'
import { newId } from '../state/factories'
import { foodsById } from '../state/selectors'

type Tab = 'foods' | 'recipes'

export default function AddEntryPage() {
  const { date, meal } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { foods, recipes } = useAppState()

  const [tab, setTab] = useState<Tab>('foods')
  const [selected, setSelected] = useState<{ kind: Tab; id: string } | null>(null)

  const index = useMemo(() => foodsById(foods), [foods])

  const foodItems = useMemo<SearchItem[]>(
    () =>
      [...foods]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((food) => ({
          id: food.id,
          name: food.brand ? `${food.name} · ${food.brand}` : food.name,
          detail: `${Math.round(food.per100g.kcal)} kcal per 100 g${
            food.defaultServing ? ` · ${food.defaultServing.label} = ${food.defaultServing.grams} g` : ''
          }`,
          keywords: food.category ?? '',
          badge: food.source === 'user' ? 'Mine' : undefined,
        })),
    [foods],
  )

  const recipeItems = useMemo<SearchItem[]>(
    () =>
      [...recipes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((recipe) => {
          const single = roundNutrients(recipePerServing(recipe, index))
          return {
            id: recipe.id,
            name: recipe.name,
            detail: `${single.kcal} kcal per serving · makes ${recipe.servings}`,
          }
        }),
    [recipes, index],
  )

  if (!date || !isValidDateKey(date) || !meal || !MEAL_TYPES.includes(meal as MealType)) {
    return <Navigate to={`/day/${todayKey()}`} replace />
  }

  const mealType = meal as MealType
  const backTo = `/day/${date}`
  const subtitle = `${MEAL_LABELS[mealType]} · ${formatDayLabel(date)}`

  const selectedFood = selected?.kind === 'foods' ? index.get(selected.id) : undefined
  const selectedRecipe =
    selected?.kind === 'recipes' ? recipes.find((recipe) => recipe.id === selected.id) : undefined

  if (selectedFood) {
    return (
      <Page title="How much?" subtitle={subtitle} backTo={backTo}>
        <QuantityPanel
          target={{ kind: 'food', food: selectedFood }}
          initialQuantity={selectedFood.defaultServing?.grams ?? 100}
          confirmLabel={`Add to ${MEAL_LABELS[mealType].toLowerCase()}`}
          onCancel={() => setSelected(null)}
          onConfirm={(grams, nutrients) => {
            dispatch({
              type: 'entry/add',
              entry: {
                id: newId(),
                date,
                meal: mealType,
                ref: { kind: 'food', id: selectedFood.id, grams },
                label: selectedFood.brand
                  ? `${selectedFood.name} (${selectedFood.brand})`
                  : selectedFood.name,
                nutrients,
                loggedAt: new Date().toISOString(),
              },
            })
            navigate(backTo)
          }}
        />
      </Page>
    )
  }

  if (selectedRecipe) {
    return (
      <Page title="How many servings?" subtitle={subtitle} backTo={backTo}>
        <QuantityPanel
          target={{ kind: 'recipe', recipe: selectedRecipe }}
          perServing={recipePerServing(selectedRecipe, index)}
          initialQuantity={1}
          confirmLabel={`Add to ${MEAL_LABELS[mealType].toLowerCase()}`}
          onCancel={() => setSelected(null)}
          onConfirm={(servings, nutrients) => {
            dispatch({
              type: 'entry/add',
              entry: {
                id: newId(),
                date,
                meal: mealType,
                ref: { kind: 'recipe', id: selectedRecipe.id, servings },
                label: selectedRecipe.name,
                nutrients,
                loggedAt: new Date().toISOString(),
              },
            })
            navigate(backTo)
          }}
        />
      </Page>
    )
  }

  return (
    <Page title={`Add to ${MEAL_LABELS[mealType].toLowerCase()}`} subtitle={subtitle} backTo={backTo}>
      <div
        className="mb-3 flex gap-1 rounded-xl p-1"
        style={{ background: 'var(--track)' }}
        role="tablist"
        aria-label="What to add"
      >
        {(['foods', 'recipes'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
              tab === value ? 'text-brand' : 'muted'
            }`}
            style={tab === value ? { background: 'var(--surface-raised)' } : undefined}
          >
            {value} ({value === 'foods' ? foods.length : recipes.length})
          </button>
        ))}
      </div>

      <SearchList
        key={tab}
        items={tab === 'foods' ? foodItems : recipeItems}
        onSelect={(id) => setSelected({ kind: tab, id })}
        placeholder={tab === 'foods' ? 'Search foods' : 'Search recipes'}
        emptyMessage={
          tab === 'foods'
            ? 'No foods match that search. Add it from the Foods tab.'
            : 'No recipes yet. Build one from the Recipes tab.'
        }
      />
    </Page>
  )
}
