import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import Page from '../components/Page'
import QuantityPanel, { type QuantityTarget } from '../components/QuantityPanel'
import { formatDayLabel, isValidDateKey, todayKey } from '../domain/date'
import { multiplyNutrients, recipePerServing } from '../domain/nutrition'
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '../domain/types'
import { useAppState, useDispatch } from '../state/AppStore'
import { entriesForDate, foodsById } from '../state/selectors'

export default function EditEntryPage() {
  const { date, entryId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const state = useAppState()

  const index = useMemo(() => foodsById(state.foods), [state.foods])

  if (!date || !isValidDateKey(date)) return <Navigate to={`/day/${todayKey()}`} replace />

  const backTo = `/day/${date}`
  const entry = entriesForDate(state, date).find((candidate) => candidate.id === entryId)

  if (!entry) {
    return (
      <Page title="Entry not found" backTo={backTo}>
        <p className="muted">That entry is no longer in your log.</p>
      </Page>
    )
  }

  const food = entry.ref.kind === 'food' ? index.get(entry.ref.id) : undefined
  const recipe =
    entry.ref.kind === 'recipe'
      ? state.recipes.find((candidate) => candidate.id === entry.ref.id)
      : undefined

  const quantity = entry.ref.kind === 'food' ? entry.ref.grams : entry.ref.servings

  function changeMeal(meal: MealType) {
    if (!entry) return
    dispatch({ type: 'entry/update', entry: { ...entry, meal } })
  }

  function remove() {
    if (!entry) return
    dispatch({ type: 'entry/delete', date: date as string, id: entry.id })
    navigate(backTo)
  }

  const mealPicker = (
    <section className="card mb-4 p-4">
      <h2 className="mb-3 font-semibold">Meal</h2>
      <div className="flex flex-wrap gap-2">
        {MEAL_TYPES.map((meal) => (
          <button
            key={meal}
            type="button"
            onClick={() => changeMeal(meal)}
            aria-pressed={entry.meal === meal}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              entry.meal === meal ? 'bg-brand text-white' : ''
            }`}
            style={entry.meal === meal ? undefined : { background: 'var(--track)' }}
          >
            {MEAL_LABELS[meal]}
          </button>
        ))}
      </div>
    </section>
  )

  // The original food or recipe may since have been deleted. Rather than block
  // the edit, rebuild a stand-in from the snapshot that was logged at the time
  // so the quantity still reads in its own unit.
  const deletedSource = !food && !recipe

  const target: QuantityTarget = food
    ? { kind: 'food', food }
    : recipe
      ? { kind: 'recipe', recipe }
      : entry.ref.kind === 'food'
        ? {
            kind: 'food',
            food: {
              id: entry.ref.id,
              name: entry.label,
              // nutrients = per100g x grams/100, so per100g = nutrients/grams x 100.
              per100g: multiplyNutrients(entry.nutrients, quantity > 0 ? 100 / quantity : 0),
              source: 'user',
              createdAt: entry.loggedAt,
            },
          }
        : {
            kind: 'recipe',
            recipe: {
              id: entry.ref.id,
              name: entry.label,
              servings: 1,
              ingredients: [],
              createdAt: entry.loggedAt,
            },
          }

  const perServing = recipe
    ? recipePerServing(recipe, index)
    : target.kind === 'recipe'
      ? multiplyNutrients(entry.nutrients, quantity > 0 ? 1 / quantity : 0)
      : undefined

  return (
    <Page title={entry.label} subtitle={formatDayLabel(date)} backTo={backTo}>
      {mealPicker}
      {deletedSource && (
        <p className="card mb-4 p-4 text-sm muted">
          The {entry.ref.kind} this came from has been deleted, so the amounts below are scaled from
          what was originally logged.
        </p>
      )}
      <QuantityPanel
        target={target}
        perServing={perServing}
        initialQuantity={quantity}
        confirmLabel="Save changes"
        onCancel={() => navigate(backTo)}
        onConfirm={(amount, nutrients) => {
          dispatch({
            type: 'entry/update',
            entry: {
              ...entry,
              ref:
                entry.ref.kind === 'food'
                  ? { kind: 'food', id: entry.ref.id, grams: amount }
                  : { kind: 'recipe', id: entry.ref.id, servings: amount },
              nutrients,
            },
          })
          navigate(backTo)
        }}
      />
      <div className="mt-4">
        <Button variant="ghost" onClick={remove}>
          Remove from log
        </Button>
      </div>
    </Page>
  )
}
