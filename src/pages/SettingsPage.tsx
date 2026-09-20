import { useRef, useState } from 'react'
import Button from '../components/Button'
import NumberField from '../components/NumberField'
import Page from '../components/Page'
import { kcalFromMacros, round } from '../domain/nutrition'
import type { Goals } from '../domain/types'
import { useDispatch, useAppState } from '../state/AppStore'
import { ImportError, backupFilename, buildBackup, parseBackup } from '../state/transfer'
import { DEFAULT_GOALS } from '../storage/repository'
import { SEED_VERSION } from '../storage/seed'

type GoalForm = Record<keyof Goals, string>

const toForm = (goals: Goals): GoalForm => ({
  kcal: String(goals.kcal),
  fat: String(goals.fat),
  satFat: String(goals.satFat),
  carbs: String(goals.carbs),
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
  protein: toNumber(form.protein),
  salt: toNumber(form.salt),
})

export default function SettingsPage() {
  const state = useAppState()
  const dispatch = useDispatch()
  const fileInput = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<GoalForm>(() => toForm(state.goals))
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const goals = toGoals(form)
  const macroKcal = kcalFromMacros(goals)
  const satOverFat = goals.satFat > goals.fat
  const valid = goals.kcal > 0 && !satOverFat

  const set = (key: keyof Goals) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function saveGoals() {
    dispatch({ type: 'goals/set', goals })
    setSaved(true)
  }

  function resetToDefaults() {
    setForm(toForm(DEFAULT_GOALS))
    setSaved(false)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(buildBackup(state), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFilename()
    link.click()
    URL.revokeObjectURL(url)
    setMessage({ tone: 'ok', text: 'Backup downloaded.' })
  }

  async function importData(file: File) {
    try {
      const imported = parseBackup(await file.text())
      dispatch({ type: 'data/replace', state: imported })
      setForm(toForm(imported.goals))
      const days = Object.keys(imported.log).length
      setMessage({
        tone: 'ok',
        text: `Imported ${imported.foods.length} foods, ${imported.recipes.length} recipes and ${days} logged ${days === 1 ? 'day' : 'days'}.`,
      })
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof ImportError ? error.message : 'Could not read that file.',
      })
    }
  }

  function resetEverything() {
    dispatch({ type: 'data/clear' })
    dispatch({ type: 'seed/apply', seedVersion: SEED_VERSION })
    setForm(toForm(DEFAULT_GOALS))
    setConfirmingReset(false)
    setMessage({ tone: 'ok', text: 'All data cleared and starter foods restored.' })
  }

  return (
    <Page title="Settings" subtitle="Daily targets and your data">
      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Daily targets</h2>
        <p className="mb-4 text-sm muted">
          Everything on the Today screen is measured against these numbers.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Calories" value={form.kcal} onChange={set('kcal')} suffix="kcal" step="10" />
          <NumberField label="Carbohydrate" value={form.carbs} onChange={set('carbs')} suffix="g" />
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
          {goals.kcal > 0 && (
            <>
              {' '}
              — {round((macroKcal / goals.kcal) * 100, 0)}% of your calorie goal
            </>
          )}
          .
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={saveGoals} disabled={!valid}>
            Save targets
          </Button>
          <Button variant="secondary" onClick={resetToDefaults}>
            Use defaults
          </Button>
          {saved && <span className="text-sm text-brand">Saved</span>}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Your data</h2>
        <p className="mb-4 text-sm muted">
          Everything is stored in this browser only — nothing is uploaded anywhere. Clearing your
          browser data deletes it, so export a backup before you do, or to move to another device.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportData}>
            Export backup
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            Import backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importData(file)
              event.target.value = ''
            }}
          />
        </div>

        {message && (
          <p
            className="mt-3 text-sm"
            style={{ color: message.tone === 'error' ? 'var(--color-over)' : undefined }}
          >
            {message.text}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          {[
            ['Foods', state.foods.length],
            ['Recipes', state.recipes.length],
            ['Days logged', Object.keys(state.log).length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl px-2 py-3" style={{ background: 'var(--track)' }}>
              <dt className="text-xs muted">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">Start over</h2>
        <p className="mb-4 text-sm muted">
          Deletes every food, recipe and logged meal in this browser, then restores the starter
          foods. This cannot be undone.
        </p>
        {confirmingReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Delete everything?</span>
            <Button variant="danger" onClick={resetEverything}>
              Yes, delete it all
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingReset(true)}>
            Reset all data
          </Button>
        )}
      </section>
    </Page>
  )
}
