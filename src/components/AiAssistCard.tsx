import Button from './Button'
import type { AiMode } from './AiAssist'

/**
 * The entry point into the AI assist, identical on foods and recipes:
 * photo first, description second.
 */
export default function AiAssistCard({
  target,
  onStart,
}: {
  target: 'food' | 'recipe'
  onStart: (mode: AiMode) => void
}) {
  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-1 font-semibold">Let Gemini work it out</h2>
      <p className="mb-3 text-sm muted">
        {target === 'food'
          ? 'Photograph the food or its label, or just describe it. You check the figures before saving.'
          : 'Photograph the meal, or describe it — "28g coffee beans in a moka pot + 200g whole milk, serves 2". You check it before saving.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onStart('photo')}>
          Photo
        </Button>
        <Button variant="secondary" onClick={() => onStart('describe')}>
          Describe
        </Button>
      </div>
    </section>
  )
}
