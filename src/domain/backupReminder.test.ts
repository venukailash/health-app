import { describe, expect, it } from 'vitest'
import { BACKUP_REMINDER_DAYS, backupReminder, snoozeUntil } from './backupReminder'

const iso = (key: string) => `${key}T09:00:00.000Z`

describe('backupReminder', () => {
  it('stays quiet when there is nothing to lose', () => {
    expect(backupReminder({ oldestDataKey: null }, '2026-10-10').due).toBe(false)
  })

  it('runs the clock from the oldest data until the first backup', () => {
    const young = backupReminder({ oldestDataKey: '2026-10-01' }, '2026-10-10')
    expect(young).toEqual({ due: false, days: 9, everBackedUp: false })

    const old = backupReminder({ oldestDataKey: '2026-09-20' }, '2026-10-10')
    expect(old).toEqual({ due: true, days: 20, everBackedUp: false })
  })

  it('runs the clock from the last backup once there has been one', () => {
    const input = { oldestDataKey: '2026-01-01', lastBackupAt: iso('2026-10-08') }
    expect(backupReminder(input, '2026-10-10')).toEqual({
      due: false,
      days: 2,
      everBackedUp: true,
    })
  })

  it('becomes due on the fifteenth day, not the sixteenth', () => {
    const due = (today: string) =>
      backupReminder({ oldestDataKey: '2026-10-01', lastBackupAt: iso('2026-10-01') }, today).due

    expect(BACKUP_REMINDER_DAYS).toBe(15)
    expect(due('2026-10-15')).toBe(false)
    expect(due('2026-10-16')).toBe(true)
  })

  it('respects a snooze until the day it expires', () => {
    const input = { oldestDataKey: '2026-09-01', snoozedUntil: '2026-10-12' }
    expect(backupReminder(input, '2026-10-10').due).toBe(false)
    expect(backupReminder(input, '2026-10-12').due).toBe(true)
  })

  it('never fires once reminders are switched off', () => {
    const input = { oldestDataKey: '2020-01-01', remindersOff: true }
    expect(backupReminder(input, '2026-10-10').due).toBe(false)
  })

  it('does not nag on a timestamp it cannot read', () => {
    const input = { oldestDataKey: '2020-01-01', lastBackupAt: 'not a date' }
    expect(backupReminder(input, '2026-10-10')).toEqual({
      due: false,
      days: 0,
      everBackedUp: true,
    })
  })

  it('does not report negative days when the clock has gone backwards', () => {
    const input = { oldestDataKey: '2026-10-20' }
    expect(backupReminder(input, '2026-10-10').days).toBe(0)
  })

  it('snoozes by a full reminder period', () => {
    expect(snoozeUntil('2026-10-10')).toBe('2026-10-25')
  })
})
