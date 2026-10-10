import { useRef, useState } from 'react'
import Button from '../components/Button'
import Page from '../components/Page'
import SettingsTabs from '../components/SettingsTabs'
import { useAppState, useDispatch } from '../state/AppStore'
import { ImportError, backupFilename, buildBackup, parseBackup } from '../state/transfer'
import { DEMO_API_KEY } from '../services/foodDataCentral'
import { DEFAULT_GEMINI_MODEL } from '../services/gemini'
import { SEED_VERSION } from '../storage/seed'

export default function AppSettingsPage() {
  const state = useAppState()
  const dispatch = useDispatch()
  const fileInput = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [apiKey, setApiKey] = useState(state.meta.fdcApiKey ?? '')
  const [keySaved, setKeySaved] = useState(false)
  const [geminiKey, setGeminiKey] = useState(state.meta.geminiApiKey ?? '')
  const [geminiModel, setGeminiModel] = useState(state.meta.geminiModel ?? '')
  const [geminiSaved, setGeminiSaved] = useState(false)

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
    setConfirmingReset(false)
    setMessage({ tone: 'ok', text: 'All data cleared and starter foods restored.' })
  }

  return (
    <Page title="App" subtitle="Search, backups and storage">
      <SettingsTabs active="app" />

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Food search</h2>
        <p className="mb-4 text-sm muted">
          Searching queries Open Food Facts for branded products and USDA FoodData Central for
          generic and cooked foods. Without a key of your own, FoodData Central uses a shared demo
          key limited to about ten searches an hour. A personal key is free and instant from{' '}
          <a
            href="https://fdc.nal.usda.gov/api-key-signup.html"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline"
          >
            fdc.nal.usda.gov
          </a>{' '}
          and raises that to 1,000 an hour. Barcode scanning needs no key.
        </p>

        <label htmlFor="fdc-key" className="mb-1 block text-sm font-medium">
          FoodData Central API key <span className="muted">(optional)</span>
        </label>
        <input
          id="fdc-key"
          className="field"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={DEMO_API_KEY}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value)
            setKeySaved(false)
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              dispatch({
                type: 'meta/set',
                meta: { ...state.meta, fdcApiKey: apiKey.trim() || undefined },
              })
              setKeySaved(true)
            }}
          >
            Save key
          </Button>
          {state.meta.fdcApiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                setApiKey('')
                dispatch({ type: 'meta/set', meta: { ...state.meta, fdcApiKey: undefined } })
                setKeySaved(true)
              }}
            >
              Remove
            </Button>
          )}
          {keySaved && <span className="text-sm text-brand">Saved</span>}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Estimate from a photo</h2>
        <p className="mb-4 text-sm muted">
          With a Google Gemini key, the food editor can suggest nutrition from a photo. It is
          always an estimate and always shown for you to check. Get a free key at{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline"
          >
            aistudio.google.com/apikey
          </a>
          .
        </p>

        <p
          className="mb-4 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--track)' }}
        >
          <strong>The key is stored on this device, in the browser.</strong> Anyone with the
          device can read it, and it is sent straight to Google from here. Use a key created only
          for this, and set a spending cap on it in Google Cloud.
        </p>

        <label htmlFor="gemini-key" className="mb-1 block text-sm font-medium">
          Gemini API key <span className="muted">(optional)</span>
        </label>
        <input
          id="gemini-key"
          className="field"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={geminiKey}
          onChange={(event) => {
            setGeminiKey(event.target.value)
            setGeminiSaved(false)
          }}
        />

        <label htmlFor="gemini-model" className="mb-1 mt-3 block text-sm font-medium">
          Model <span className="muted">(optional)</span>
        </label>
        <input
          id="gemini-model"
          className="field"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={DEFAULT_GEMINI_MODEL}
          value={geminiModel}
          onChange={(event) => {
            setGeminiModel(event.target.value)
            setGeminiSaved(false)
          }}
        />
        <p className="mt-1 text-xs muted">
          Defaults to {DEFAULT_GEMINI_MODEL}, the cheapest that can read an image. Change it if
          Google retires that name.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              dispatch({
                type: 'meta/set',
                meta: {
                  ...state.meta,
                  geminiApiKey: geminiKey.trim() || undefined,
                  geminiModel: geminiModel.trim() || undefined,
                },
              })
              setGeminiSaved(true)
            }}
          >
            Save
          </Button>
          {state.meta.geminiApiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                setGeminiKey('')
                dispatch({ type: 'meta/set', meta: { ...state.meta, geminiApiKey: undefined } })
                setGeminiSaved(true)
              }}
            >
              Remove key
            </Button>
          )}
          {geminiSaved && <span className="text-sm text-brand">Saved</span>}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Your data</h2>
        <p className="mb-4 text-sm muted">
          Everything is stored in this browser only — nothing is uploaded anywhere. Clearing your
          browser data deletes it, so export a backup before you do, or to move to another device.
          API keys are deliberately left out of backups.
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
