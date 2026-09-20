import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  dateRange,
  diffInDays,
  formatDayLabel,
  fromDateKey,
  isValidDateKey,
  toDateKey,
  todayKey,
} from './date'

afterEach(() => {
  vi.useRealTimers()
})

describe('toDateKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 8, 20))).toBe('2026-09-20')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('uses the local calendar day for a late-evening timestamp, not UTC', () => {
    // 23:30 local. toISOString() would report the next day for any timezone
    // east of UTC; the log must file this under the day the user experienced.
    const lateEvening = new Date(2026, 8, 20, 23, 30)
    expect(toDateKey(lateEvening)).toBe('2026-09-20')
    expect(toDateKey(lateEvening)).toBe(
      `${lateEvening.getFullYear()}-09-${String(lateEvening.getDate()).padStart(2, '0')}`,
    )
  })

  it('uses the local calendar day for an early-morning timestamp', () => {
    expect(toDateKey(new Date(2026, 8, 20, 0, 15))).toBe('2026-09-20')
  })
})

describe('todayKey', () => {
  it('tracks the mocked system clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 22, 45))
    expect(todayKey()).toBe('2026-09-20')
  })
})

describe('fromDateKey', () => {
  it('parses to local midnight', () => {
    const date = fromDateKey('2026-09-20')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(20)
    expect(date.getHours()).toBe(0)
  })

  it('round-trips through toDateKey', () => {
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28')
  })
})

describe('isValidDateKey', () => {
  it('accepts well-formed keys', () => {
    expect(isValidDateKey('2026-09-20')).toBe(true)
    expect(isValidDateKey('2024-02-29')).toBe(true)
  })

  it('rejects malformed or impossible dates', () => {
    expect(isValidDateKey('2026-9-20')).toBe(false)
    expect(isValidDateKey('20-09-2026')).toBe(false)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
    expect(isValidDateKey(undefined)).toBe(false)
    expect(isValidDateKey(20260920)).toBe(false)
  })
})

describe('addDays', () => {
  it('moves forwards and backwards', () => {
    expect(addDays('2026-09-20', 1)).toBe('2026-09-21')
    expect(addDays('2026-09-20', -1)).toBe('2026-09-19')
    expect(addDays('2026-09-20', 0)).toBe('2026-09-20')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('lands on the right calendar day across a DST transition', () => {
    // UK clocks go forward 2026-03-29 and back 2026-10-25. Stepping a day
    // must always change the calendar date by exactly one, never zero or two.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('steps a full year one day at a time without drifting', () => {
    let key = '2026-01-01'
    for (let index = 0; index < 365; index += 1) key = addDays(key, 1)
    expect(key).toBe('2027-01-01')
  })
})

describe('diffInDays', () => {
  it('counts days between keys', () => {
    expect(diffInDays('2026-09-20', '2026-09-27')).toBe(7)
    expect(diffInDays('2026-09-27', '2026-09-20')).toBe(-7)
    expect(diffInDays('2026-09-20', '2026-09-20')).toBe(0)
  })

  it('is unaffected by DST', () => {
    expect(diffInDays('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('dateRange', () => {
  it('is inclusive of both ends', () => {
    expect(dateRange('2026-09-18', '2026-09-20')).toEqual([
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })

  it('returns a single day when both ends match', () => {
    expect(dateRange('2026-09-20', '2026-09-20')).toEqual(['2026-09-20'])
  })

  it('returns empty when the range is inverted', () => {
    expect(dateRange('2026-09-20', '2026-09-18')).toEqual([])
  })
})

describe('formatDayLabel', () => {
  it('names the days around today', () => {
    expect(formatDayLabel('2026-09-20', '2026-09-20')).toBe('Today')
    expect(formatDayLabel('2026-09-19', '2026-09-20')).toBe('Yesterday')
    expect(formatDayLabel('2026-09-21', '2026-09-20')).toBe('Tomorrow')
  })

  it('falls back to a weekday and date further out', () => {
    const label = formatDayLabel('2026-09-14', '2026-09-20')
    expect(label).not.toBe('Today')
    expect(label).toMatch(/14/)
  })
})
