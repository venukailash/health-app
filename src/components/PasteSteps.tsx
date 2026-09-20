import { useState } from 'react'
import Button from './Button'
import { parseStepsPayload, type ParsedDay } from '../domain/activity'

/**
 * Import steps from text the Shortcut put on the clipboard.
 *
 * The clipboard is the transport because a URL cannot be: an installed iOS
 * web app has its own storage partition, so a link opened from Shortcuts
 * lands in Safari's copy of the app and never reaches this one.
 *
 * Reading the clipboard directly is offered first, and a box to paste into is
 * always visible — Safari only allows a clipboard read from a user gesture and
 * will sometimes refuse it anyway.
 */
export default function PasteSteps({
  onImport,
}: {
  onImport: (days: ParsedDay[]) => void
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [rejected, setRejected] = useState<{ raw: string; reason: string }[]>([])

  function handle(payload: string) {
    const trimmed = payload.trim()
    if (trimmed === '') {
      setStatus('There was nothing to import.')
      return
    }

    // Accept a whole URL as well as a bare payload — pasting the entire link
    // the Shortcut built is the obvious thing to try.
    const afterQuery = trimmed.includes('days=') ? trimmed.split('days=')[1] : trimmed
    const parsed = parseStepsPayload(decodeURIComponent(afterQuery.split('&')[0]))

    setRejected(parsed.rejected)
    if (parsed.days.length === 0) {
      setStatus('Nothing in that could be read as step counts.')
      return
    }

    onImport(parsed.days)
    setText('')
    setStatus(
      `Imported ${parsed.days.length} ${parsed.days.length === 1 ? 'day' : 'days'}.` +
        (parsed.rejected.length > 0 ? ` ${parsed.rejected.length} skipped.` : ''),
    )
  }

  async function readClipboard() {
    try {
      const payload = await navigator.clipboard.readText()
      handle(payload)
    } catch {
      setStatus('Could not read the clipboard. Paste into the box below instead.')
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button onClick={() => void readClipboard()}>Paste from clipboard</Button>
        {text.trim() !== '' && (
          <Button variant="secondary" onClick={() => handle(text)}>
            Import what is in the box
          </Button>
        )}
      </div>

      <label htmlFor="paste-steps" className="mb-1 block text-sm font-medium">
        Or paste it here
      </label>
      <textarea
        id="paste-steps"
        className="field font-mono text-xs"
        rows={2}
        placeholder="2026-09-20:8421,2026-09-19:10233"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {status && <p className="mt-2 text-sm">{status}</p>}

      {rejected.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs muted">
          {rejected.slice(0, 4).map((entry, index) => (
            <li key={index}>
              <code>{entry.raw.slice(0, 32)}</code> — {entry.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
