import { useState } from 'react'
import Button from './Button'
import {
  DEFAULT_GEMINI_MODEL,
  estimateGoals,
  geminiErrorMessage,
  type GoalsEstimate,
} from '../services/gemini'
import type { Goals } from '../domain/types'
import { useAppState } from '../state/AppStore'

const EXAMPLE =
  '38, male, 178cm, 82kg, desk job, gym twice a week, want to lose about 5kg over three months'

/**
 * Describe yourself, get a set of daily targets to check.
 *
 * Collapsed until asked for, because typing the numbers in by hand stays the
 * normal way to do this and the form below should not be pushed down the page
 * for everyone.
 *
 * Separate from `AiAssist` on purpose. That component is the one way to get
 * NUTRITION FOR A FOOD out of Gemini and is built around photo-first input;
 * this fills a settings form, takes words only, and shares the parts worth
 * sharing — the estimator and the error wording — rather than the shape.
 */
export default function SuggestTargets({ onSuggest }: { onSuggest: (goals: Goals) => void }) {
  const { meta } = useAppState()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<GoalsEstimate | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setEstimate(null)
    try {
      const result = await estimateGoals(text, {
        apiKey: meta.geminiApiKey,
        model: meta.geminiModel || DEFAULT_GEMINI_MODEL,
      })
      setEstimate(result)
      // Straight into the boxes below. There is no "use these figures" step:
      // the fields are right there, still editable, and nothing is saved until
      // Save is pressed — a confirmation button would only be a second tap.
      onSuggest(result.goals)
    } catch (caught) {
      setError(geminiErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Not sure what to aim for?</h2>
        <p className="mb-3 text-sm muted">
          Describe yourself and Gemini will suggest a set of targets to start from.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Suggest targets for me
        </Button>
      </section>
    )
  }

  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-1 font-semibold">Suggest targets</h2>
      <p className="mb-3 text-sm muted">
        The more you say, the closer it gets. Height, weight, age, how active you are, and what
        you are trying to do.
      </p>

      <label htmlFor="about-me" className="mb-1 block text-sm font-medium">
        About you
      </label>
      <textarea
        id="about-me"
        className="field"
        rows={3}
        placeholder={EXAMPLE}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="button"
        onClick={() => setText(EXAMPLE)}
        className="mt-2 rounded-full px-2.5 py-1 text-left text-xs muted hover:text-brand"
        style={{ background: 'var(--track)' }}
      >
        Use the example
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void run()} disabled={busy || text.trim() === ''}>
          {busy ? 'Working it out…' : estimate ? 'Try again' : 'Suggest targets'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Close
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-over)' }}>
          {error}
        </p>
      )}

      {estimate && (
        <div className="mt-4 rounded-xl px-3 py-3 text-sm" style={{ background: 'var(--track)' }}>
          <p className="font-medium">Filled in below — check them and press Save.</p>
          {estimate.rationale && <p className="mt-1 muted">{estimate.rationale}</p>}
          {estimate.caveat && (
            <p className="mt-1" style={{ color: 'var(--color-over)' }}>
              {estimate.caveat}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs muted">
        A starting point, not medical advice. Nobody has weighed you or read your notes — if you
        are managing a health condition, pregnant, or under a dietitian, go with what they say.
      </p>
    </section>
  )
}
