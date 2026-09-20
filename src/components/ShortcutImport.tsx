import Button from './Button'
import { useShortcutImport } from '../hooks/useShortcutImport'
import type { ParsedDay } from '../domain/activity'

/**
 * Run the Shortcut and bring the steps back in one tap where the browser
 * allows it, two where it does not.
 */
export default function ShortcutImport({
  shortcutName,
  onImport,
  onMessage,
}: {
  shortcutName: string | undefined
  onImport: (days: ParsedDay[]) => void
  onMessage: (message: string, tone: 'info' | 'error') => void
}) {
  const { run, importing, needsTap, pasteNow, dismiss } = useShortcutImport({
    shortcutName,
    onImport,
    onEmpty: (reason) =>
      reason === 'unreadable'
        ? onMessage('The clipboard did not hold any step counts. Run the Shortcut first.', 'error')
        : undefined,
  })

  if (!shortcutName) return null

  if (needsTap) {
    return (
      <div className="mb-3">
        <p className="mb-2 text-sm">
          Shortcut finished. Your browser will not read the clipboard on its own, so one tap:
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void pasteNow()} disabled={importing}>
            {importing ? 'Importing…' : 'Import the steps'}
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <Button onClick={run} disabled={importing}>
        {importing ? 'Importing…' : `Run “${shortcutName}” and import`}
      </Button>
      <p className="mt-2 text-xs muted">
        Opens Shortcuts, then brings the counts back when you return. If your browser blocks
        reading the clipboard, it will ask for one tap.
      </p>
    </div>
  )
}
