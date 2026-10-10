import Button from './Button'
import { snoozeUntil } from '../domain/backupReminder'
import { todayKey } from '../domain/date'
import { useAppState, useDispatch } from '../state/AppStore'
import { downloadBackup } from '../state/downloadBackup'
import { useToast } from '../state/ToastProvider'

/**
 * A prompt to export a backup, shown on Today when one is overdue.
 *
 * It is a banner rather than a notification because a scheduled notification
 * needs a server to send it — see docs/DECISIONS.md. Nothing fires while the
 * app is closed, so this is the only moment there is.
 */
export default function BackupReminder({
  days,
  everBackedUp,
}: {
  days: number
  everBackedUp: boolean
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const { showToast } = useToast()

  const setMeta = (patch: Partial<typeof state.meta>) =>
    dispatch({ type: 'meta/set', meta: { ...state.meta, ...patch } })

  return (
    <section
      className="card mb-4 p-4"
      aria-labelledby="backup-reminder-heading"
      style={{ borderColor: 'var(--color-brand)' }}
    >
      <h2 id="backup-reminder-heading" className="mb-1 font-semibold">
        Time to back up
      </h2>
      <p className="mb-4 text-sm muted">
        {everBackedUp
          ? `Your last backup was ${days} days ago.`
          : `You have had data in here for ${days} days and have never backed it up.`}{' '}
        Everything lives in this browser, so clearing its data would take the lot.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            downloadBackup(state)
            setMeta({
              lastBackupAt: new Date().toISOString(),
              backupReminderSnoozedUntil: undefined,
            })
            showToast('Backup downloaded.', { tone: 'success' })
          }}
        >
          Back up now
        </Button>
        <Button
          variant="secondary"
          onClick={() => setMeta({ backupReminderSnoozedUntil: snoozeUntil(todayKey()) })}
        >
          Later
        </Button>
        <Button variant="ghost" onClick={() => setMeta({ backupRemindersOff: true })}>
          Never remind me
        </Button>
      </div>
    </section>
  )
}
