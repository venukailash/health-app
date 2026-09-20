import { useState } from 'react'
import Button from '../components/Button'
import NumberField from '../components/NumberField'
import Page from '../components/Page'
import SettingsTabs from '../components/SettingsTabs'
import { kcalFromMacros, round } from '../domain/nutrition'
import type { Goals } from '../domain/types'
import { useAppState, useDispatch } from '../state/AppStore'
import { DEFAULT_ACTIVITY_GOALS, DEFAULT_GOALS } from '../storage/repository'

type GoalForm = Record<keyof Goals, string>

const toForm = (goals: Goals): GoalForm => ({
  kcal: String(goals.kcal),
  fat: String(goals.fat),
  satFat: String(goals.satFat),
  carbs: String(goals.carbs),
  fibre: String(goals.fibre),
  protein: String(goals.protein),
  salt: String(goals.salt),
})

const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const toGoals = (form: GoalForm): Goals => ({
  kcal: toNumber(form.kcal),
  fat: toNumber(form.fat),
  satFat: toNumber(form.satFat),
  carbs: toNumber(form.carbs),
  fibre: toNumber(form.fibre),
  protein: toNumber(form.protein),
  salt: toNumber(form.salt),
})

export default function TargetsSettingsPage() {
  const state = useAppState()
  const dispatch = useDispatch()

  const [form, setForm] = useState<GoalForm>(() => toForm(state.goals))
  const [steps, setSteps] = useState(String(state.activityGoals.steps))
  const [saved, setSaved] = useState(false)

  const goals = toGoals(form)
  const macroKcal = kcalFromMacros(goals)
  const satOverFat = goals.satFat > goals.fat
  const stepsTarget = Math.max(0, Math.round(toNumber(steps)))
  const valid = goals.kcal > 0 && !satOverFat

  const set = (key: keyof Goals) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function saveAll() {
    dispatch({ type: 'goals/set', goals })
    dispatch({ type: 'activityGoals/set', goals: { steps: stepsTarget } })
    setSaved(true)
  }

  function useDefaults() {
    setForm(toForm(DEFAULT_GOALS))
    setSteps(String(DEFAULT_ACTIVITY_GOALS.steps))
    setSaved(false)
  }

  return (
    <Page title="Targets" subtitle="What you are aiming for each day">
      <SettingsTabs active="targets" />

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Food</h2>
        <p className="mb-4 text-sm muted">
          Everything on the Progress screens is measured against these numbers.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Calories" value={form.kcal} onChange={set('kcal')} suffix="kcal" step="10" />
          <NumberField label="Carbohydrate" value={form.carbs} onChange={set('carbs')} suffix="g" />
          <NumberField label="Fibre" value={form.fibre} onChange={set('fibre')} suffix="g" />
          <NumberField label="Protein" value={form.protein} onChange={set('protein')} suffix="g" />
          <NumberField label="Fat" value={form.fat} onChange={set('fat')} suffix="g" />
          <NumberField
            label="of which saturates"
            value={form.satFat}
            onChange={set('satFat')}
            suffix="g"
            hint={satOverFat ? undefined : 'Counted inside the fat target, not on top of it.'}
          />
          <NumberField label="Salt" value={form.salt} onChange={set('salt')} suffix="g" step="0.1" />
        </div>

        {satOverFat && (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-over)' }}>
            Saturated fat cannot be higher than total fat.
          </p>
        )}
        {goals.kcal <= 0 && (
          <p className="mt-3 text-sm" style={{ color: 'var(--color-over)' }}>
            Set a calorie target above zero.
          </p>
        )}

        <p className="mt-4 text-sm muted">
          Your macro targets come to <strong className="text-[var(--text)]">{macroKcal} kcal</strong>
          {goals.kcal > 0 && <> — {round((macroKcal / goals.kcal) * 100, 0)}% of your calorie goal</>}.
        </p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Activity</h2>
        <p className="mb-4 text-sm muted">
          Your daily step target. Weekly and monthly progress compare your average against it.
        </p>
        <div className="sm:max-w-xs">
          <NumberField
            label="Steps per day"
            value={steps}
            onChange={(value) => {
              setSteps(value)
              setSaved(false)
            }}
            step="500"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={saveAll} disabled={!valid}>
          Save targets
        </Button>
        <Button variant="secondary" onClick={useDefaults}>
          Use defaults
        </Button>
        {saved && <span className="text-sm text-brand">Saved</span>}
      </div>
    </Page>
  )
}
