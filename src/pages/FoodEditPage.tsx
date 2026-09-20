import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import NumberField from '../components/NumberField'
import Page from '../components/Page'
import { kcalFromMacros, roundNutrients, scaleNutrients, unsaturatedFat } from '../domain/nutrition'
import type { Food, Nutrients } from '../domain/types'
import { useAppState, useDispatch } from '../state/AppStore'
import { createFood, duplicateFood } from '../state/factories'

type Form = {
  name: string
  brand: string
  category: string
  kcal: string
  fat: string
  satFat: string
  carbs: string
  protein: string
  salt: string
  servingLabel: string
  servingGrams: string
}

const EMPTY_FORM: Form = {
  name: '',
  brand: '',
  category: '',
  kcal: '',
  fat: '',
  satFat: '',
  carbs: '',
  protein: '',
  salt: '',
  servingLabel: '',
  servingGrams: '',
}

const num = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function toForm(food: Food): Form {
  return {
    name: food.name,
    brand: food.brand ?? '',
    category: food.category ?? '',
    kcal: String(food.per100g.kcal),
    fat: String(food.per100g.fat),
    satFat: String(food.per100g.satFat),
    carbs: String(food.per100g.carbs),
    protein: String(food.per100g.protein),
    salt: String(food.per100g.salt),
    servingLabel: food.defaultServing?.label ?? '',
    servingGrams: food.defaultServing ? String(food.defaultServing.grams) : '',
  }
}

function toNutrients(form: Form): Nutrients {
  return {
    kcal: num(form.kcal),
    fat: num(form.fat),
    satFat: num(form.satFat),
    carbs: num(form.carbs),
    protein: num(form.protein),
    salt: num(form.salt),
  }
}

export default function FoodEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { foods } = useAppState()

  const existing = id ? foods.find((food) => food.id === id) : undefined
  const readOnly = existing?.source === 'seed'

  const [form, setForm] = useState<Form>(() => (existing ? toForm(existing) : EMPTY_FORM))
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (id && !existing) {
    return (
      <Page title="Food not found" backTo="/foods">
        <p className="muted">That food is no longer in your library.</p>
      </Page>
    )
  }

  const per100g = toNutrients(form)
  const satOverFat = per100g.satFat > per100g.fat
  const nameMissing = form.name.trim() === ''
  const canSave = !nameMissing && !satOverFat && !readOnly

  const servingGrams = num(form.servingGrams)
  const preview = servingGrams > 0 ? roundNutrients(scaleNutrients(per100g, servingGrams)) : null
  const macroKcal = kcalFromMacros(per100g)
  const kcalMismatch =
    per100g.kcal > 0 && Math.abs(per100g.kcal - macroKcal) > Math.max(60, per100g.kcal * 0.3)

  const set = (key: keyof Form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  function save() {
    const draft = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      per100g,
      defaultServing:
        form.servingLabel.trim() && servingGrams > 0
          ? { label: form.servingLabel.trim(), grams: servingGrams }
          : undefined,
    }

    if (existing) {
      dispatch({
        type: 'food/update',
        food: {
          ...existing,
          name: draft.name.trim(),
          brand: draft.brand.trim() || undefined,
          category: draft.category.trim() || undefined,
          per100g: draft.per100g,
          defaultServing: draft.defaultServing,
        },
      })
    } else {
      dispatch({ type: 'food/add', food: createFood(draft) })
    }
    navigate('/foods')
  }

  function duplicate() {
    if (!existing) return
    const copy = duplicateFood(existing)
    dispatch({ type: 'food/add', food: copy })
    navigate(`/foods/${copy.id}`, { replace: true })
    setForm(toForm(copy))
  }

  function remove() {
    if (!existing) return
    dispatch({ type: 'food/delete', id: existing.id })
    navigate('/foods')
  }

  return (
    <Page
      title={existing ? existing.name : 'New food'}
      subtitle={readOnly ? 'Starter food — duplicate it to make changes' : 'Nutrition per 100 g'}
      backTo="/foods"
    >
      <fieldset disabled={readOnly} className="space-y-4">
        <section className="card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="food-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                id="food-name"
                className="field"
                value={form.name}
                onChange={(event) => set('name')(event.target.value)}
                placeholder="e.g. Greek yogurt"
              />
            </div>
            <div>
              <label htmlFor="food-brand" className="mb-1 block text-sm font-medium">
                Brand <span className="muted">(optional)</span>
              </label>
              <input
                id="food-brand"
                className="field"
                value={form.brand}
                onChange={(event) => set('brand')(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="food-category" className="mb-1 block text-sm font-medium">
                Category <span className="muted">(optional)</span>
              </label>
              <input
                id="food-category"
                className="field"
                value={form.category}
                onChange={(event) => set('category')(event.target.value)}
                placeholder="e.g. Dairy &amp; eggs"
                list="food-categories"
              />
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Per 100 g</h2>
          <p className="mb-4 text-sm muted">
            Copy these straight off the label&apos;s per-100 g column.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Energy" value={form.kcal} onChange={set('kcal')} suffix="kcal" />
            <NumberField label="Carbohydrate" value={form.carbs} onChange={set('carbs')} suffix="g" />
            <NumberField label="Protein" value={form.protein} onChange={set('protein')} suffix="g" />
            <NumberField label="Fat" value={form.fat} onChange={set('fat')} suffix="g" />
            <NumberField
              label="of which saturates"
              value={form.satFat}
              onChange={set('satFat')}
              suffix="g"
              hint={
                satOverFat
                  ? undefined
                  : `Unsaturated works out at ${unsaturatedFat(per100g).toFixed(1)} g`
              }
            />
            <NumberField label="Salt" value={form.salt} onChange={set('salt')} suffix="g" step="0.01" />
          </div>

          {satOverFat && (
            <p className="mt-3 text-sm" style={{ color: 'var(--color-over)' }}>
              Saturated fat cannot be higher than total fat.
            </p>
          )}
          {kcalMismatch && (
            <p className="mt-3 text-sm muted">
              Heads up: the macros here add up to about {macroKcal} kcal. Worth double-checking the
              label.
            </p>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Typical portion</h2>
          <p className="mb-4 text-sm muted">
            Optional shortcut when logging, e.g. &ldquo;1 slice&rdquo; at 36 g.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="serving-label" className="mb-1 block text-sm font-medium">
                Portion name
              </label>
              <input
                id="serving-label"
                className="field"
                value={form.servingLabel}
                onChange={(event) => set('servingLabel')(event.target.value)}
                placeholder="1 pot"
              />
            </div>
            <NumberField
              label="Weight"
              value={form.servingGrams}
              onChange={set('servingGrams')}
              suffix="g"
            />
          </div>

          {preview && (
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
              {[
                ['kcal', preview.kcal],
                ['Carbs', `${preview.carbs} g`],
                ['Protein', `${preview.protein} g`],
                ['Fat', `${preview.fat} g`],
                ['Sat', `${preview.satFat} g`],
                ['Salt', `${preview.salt} g`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl px-2 py-2" style={{ background: 'var(--track)' }}>
                  <dt className="text-xs muted">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {readOnly ? (
          <Button onClick={duplicate}>Duplicate to edit</Button>
        ) : (
          <>
            <Button onClick={save} disabled={!canSave}>
              {existing ? 'Save changes' : 'Add food'}
            </Button>
            {existing && !confirmingDelete && (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
            {existing && confirmingDelete && (
              <>
                <span className="text-sm">Delete this food?</span>
                <Button variant="danger" onClick={remove}>
                  Delete
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {existing && (
        <p className="mt-3 text-xs muted">
          Meals you have already logged keep the values they were logged with, so editing this food
          will not change your history.
        </p>
      )}

      <datalist id="food-categories">
        {[...new Set(foods.map((food) => food.category).filter(Boolean))].map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </Page>
  )
}
