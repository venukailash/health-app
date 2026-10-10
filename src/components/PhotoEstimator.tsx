import { useRef, useState } from 'react'
import Button from './Button'
import NutritionGrid from './NutritionGrid'
import {
  DEFAULT_GEMINI_MODEL,
  MissingKeyError,
  ModelError,
  estimateFromPhoto,
  type PhotoEstimate,
} from '../services/gemini'
import { LookupFailedError, RateLimitedError } from '../services/openFoodFacts'
import { useAppState } from '../state/AppStore'
import { round } from '../domain/nutrition'

const CONFIDENCE_NOTE: Record<PhotoEstimate['confidence'], string> = {
  low: 'Low confidence — treat these as a rough starting point and correct them.',
  medium: 'Medium confidence — worth checking against the packet if you have it.',
  high: 'High confidence, but still an estimate from a photo.',
}

/**
 * Estimate a food's nutrition from a photo.
 *
 * The result is never saved straight away. A model cannot know how a dish was
 * cooked or how much oil went into it, so the numbers are shown for review
 * first, with the model's own confidence and whatever it says it could not
 * tell. Accepting them is a deliberate act, not a side effect of taking a
 * picture.
 */
export default function PhotoEstimator({
  onAccept,
  onCancel,
}: {
  onAccept: (estimate: PhotoEstimate) => void
  onCancel: () => void
}) {
  const { meta } = useAppState()
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<PhotoEstimate | null>(null)

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setEstimate(null)
    setPreview(URL.createObjectURL(file))

    try {
      const result = await estimateFromPhoto(file, {
        apiKey: meta.geminiApiKey,
        model: meta.geminiModel || DEFAULT_GEMINI_MODEL,
      })
      setEstimate(result)
    } catch (caught) {
      if (caught instanceof MissingKeyError) setError(caught.message)
      else if (caught instanceof RateLimitedError)
        setError('Gemini is rate limiting. Try again in a minute.')
      else if (caught instanceof ModelError || caught instanceof LookupFailedError)
        setError(caught.message)
      else setError('Something went wrong reading that photo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        // Opens the camera directly on a phone, the photo library on a desktop.
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ''
        }}
      />

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">Estimate from a photo</h2>
        <p className="mb-4 text-sm muted">
          Take a picture of the food and Gemini will suggest its nutrition. Everything it returns
          is an estimate from a picture — check it before saving.
        </p>

        {preview && (
          <img
            src={preview}
            alt="The photo being estimated"
            className="mb-4 max-h-56 w-full rounded-xl object-cover"
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? 'Reading the photo…' : preview ? 'Try another photo' : 'Take a photo'}
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

      {estimate && (
        <section className="card p-4">
          <h3 className="font-semibold">{estimate.name}</h3>
          <p className="mt-1 text-sm muted">{CONFIDENCE_NOTE[estimate.confidence]}</p>
          {estimate.caveat && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-over)' }}>
              {estimate.caveat}
            </p>
          )}

          <div className="mt-4">
            <NutritionGrid nutrients={estimate.per100g} caption="Estimated per 100 g" />
          </div>

          {estimate.defaultServing && (
            <p className="mt-3 text-sm muted">
              It reckons the portion shown is about{' '}
              <strong className="text-[var(--text)]">
                {round(estimate.defaultServing.grams, 0)} g
              </strong>{' '}
              ({estimate.defaultServing.label}).
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onAccept(estimate)}>Use these figures</Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              Try another photo
            </Button>
          </div>
          <p className="mt-3 text-xs muted">
            You can edit every number on the next screen before anything is saved.
          </p>
        </section>
      )}
    </div>
  )
}
