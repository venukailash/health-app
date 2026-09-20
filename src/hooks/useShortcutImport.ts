import { useCallback, useEffect, useRef, useState } from 'react'
import { parseStepsPayload, type ParsedDay } from '../domain/activity'

/**
 * One-tap "run the Shortcut and bring the steps back".
 *
 * Tapping Run leaves the app for Shortcuts, so the fact that an import is
 * expected has to outlive the page: iOS freely discards a standalone web app
 * while another app is in front, and the flag must survive that. It is stored
 * with a timestamp and ignored once stale, so an abandoned run does not
 * ambush the next visit.
 *
 * On return we TRY to read the clipboard without asking. Safari normally
 * refuses a read that is not tied to a user gesture, and returning to an app
 * is not one — so the refusal is the expected path, not an error, and falls
 * back to a single prompt. Where a browser does allow it, the whole thing is
 * one tap.
 */

const AWAITING_KEY = 'healthapp.awaitingShortcut'
/** Beyond this, assume the run was abandoned. */
const AWAIT_WINDOW_MS = 5 * 60 * 1000
/** Shortcuts needs a moment to finish writing the clipboard after handing back. */
const SETTLE_MS = 1200

function markAwaiting(): void {
  try {
    localStorage.setItem(AWAITING_KEY, String(Date.now()))
  } catch {
    // Private mode: the one-tap path is lost, the manual one still works.
  }
}

function takeAwaiting(): boolean {
  try {
    const raw = localStorage.getItem(AWAITING_KEY)
    if (!raw) return false
    localStorage.removeItem(AWAITING_KEY)
    return Date.now() - Number(raw) < AWAIT_WINDOW_MS
  } catch {
    return false
  }
}

export interface ShortcutImport {
  /** Launch the Shortcut. */
  run: () => void
  /** True between returning to the app and the import resolving. */
  importing: boolean
  /** Set when the clipboard could not be read without a tap. */
  needsTap: boolean
  /** Read the clipboard now, from inside a real user gesture. */
  pasteNow: () => Promise<void>
  dismiss: () => void
}

export function useShortcutImport({
  shortcutName,
  onImport,
  onEmpty,
}: {
  shortcutName: string | undefined
  onImport: (days: ParsedDay[]) => void
  onEmpty?: (reason: 'unreadable' | 'blocked') => void
}): ShortcutImport {
  const [importing, setImporting] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const busy = useRef(false)

  /**
   * Callbacks are held in refs, not closed over.
   *
   * Callers pass inline arrows, so depending on them directly gave the effect
   * a new identity on every render — and since the effect itself calls
   * setState, its own cleanup cancelled the import it had just started, every
   * time. The read waits over a second for Shortcuts to finish writing, which
   * is plenty of renders to be torn down in.
   */
  const handlers = useRef({ onImport, onEmpty })
  handlers.current = { onImport, onEmpty }

  const readAndImport = useCallback(
    async (fromGesture: boolean): Promise<boolean> => {
      try {
        const payload = await navigator.clipboard.readText()
        const { days } = parseStepsPayload(
          payload.includes('days=') ? payload.split('days=')[1].split('&')[0] : payload,
        )
        if (days.length === 0) {
          handlers.current.onEmpty?.('unreadable')
          return false
        }
        handlers.current.onImport(days)
        return true
      } catch {
        // Expected on iOS unless the read came from a tap.
        if (fromGesture) handlers.current.onEmpty?.('blocked')
        return false
      }
    },
    [],
  )

  const run = useCallback(() => {
    if (!shortcutName) return
    markAwaiting()
    setNeedsTap(false)
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}`
  }, [shortcutName])

  const pasteNow = useCallback(async () => {
    setImporting(true)
    const ok = await readAndImport(true)
    setImporting(false)
    if (ok) setNeedsTap(false)
  }, [readAndImport])

  // Attempt the import whenever the app comes back to the foreground with a
  // run outstanding. Runs on mount too, since iOS may have reloaded the page.
  useEffect(() => {
    let cancelled = false

    const attempt = async () => {
      if (busy.current || document.visibilityState !== 'visible') return
      if (!takeAwaiting()) return

      busy.current = true
      setImporting(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
        if (cancelled) return

        const ok = await readAndImport(false)
        if (cancelled) return

        setImporting(false)
        setNeedsTap(!ok)
      } finally {
        // Must clear on every path, or a cancelled attempt wedges the flag on
        // and no later return can import.
        busy.current = false
      }
    }

    void attempt()
    document.addEventListener('visibilitychange', attempt)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', attempt)
    }
  }, [readAndImport])

  return { run, importing, needsTap, pasteNow, dismiss: () => setNeedsTap(false) }
}
