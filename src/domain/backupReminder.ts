import { addDays, diffInDays, isValidDateKey, toDateKey, todayKey, type DateKey } from './date'

/**
 * How stale a backup is allowed to get before the app says something.
 *
 * There is no server and no sync: a cleared browser store takes the lot. The
 * export in Settings is the only copy that can survive that, and a backup
 * nobody is reminded to take is a backup nobody takes.
 */
export const BACKUP_REMINDER_DAYS = 15

export interface BackupReminderInput {
  /** ISO timestamp of the last export, if there has ever been one. */
  lastBackupAt?: string
  /** The user asked not to be reminded again. */
  remindersOff?: boolean
  /** "Later" pushes the next reminder out to this date. */
  snoozedUntil?: DateKey
  /**
   * The oldest day with data in it, or null when there is nothing to lose.
   * This is what the clock runs from before the first ever backup, so somebody
   * three days into using the app is not told their backup is overdue.
   */
  oldestDataKey: DateKey | null
}

export interface BackupReminder {
  due: boolean
  /** Days since the last backup, or since data first appeared. */
  days: number
  /** Whether a backup has ever been taken, which changes the wording. */
  everBackedUp: boolean
}

export function backupReminder(
  input: BackupReminderInput,
  today: DateKey = todayKey(),
): BackupReminder {
  const everBackedUp = typeof input.lastBackupAt === 'string'
  const since = everBackedUp
    ? toDateKey(new Date(input.lastBackupAt as string))
    : input.oldestDataKey

  // A corrupt timestamp means we do not know, and guessing would either nag
  // forever or never nag at all.
  if (!since || !isValidDateKey(since)) return { due: false, days: 0, everBackedUp }

  const days = Math.max(0, diffInDays(since, today))
  const snoozed = input.snoozedUntil ? diffInDays(today, input.snoozedUntil) > 0 : false
  const due = !input.remindersOff && !snoozed && days >= BACKUP_REMINDER_DAYS

  return { due, days, everBackedUp }
}

/** The date a "Later" reminder comes back. */
export function snoozeUntil(today: DateKey = todayKey()): DateKey {
  return addDays(today, BACKUP_REMINDER_DAYS)
}
