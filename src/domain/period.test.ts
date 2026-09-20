import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  formatMonthLabel,
  formatMonthTitle,
  formatWeekLabel,
  formatWeekRange,
  isSameMonth,
  monthGrid,
  startOfMonth,
  startOfWeek,
  weekdayInitials,
  weekdayShort,
} from './date'

afterEach(() => {
  vi.useRealTimers()
})

describe('startOfWeek / endOfWeek', () => {
  it('treats Monday as the first day of the week', () => {
    // 2026-09-20 is a Sunday; its week runs Mon 14 to Sun 20.
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14')
    expect(endOfWeek('2026-09-20')).toBe('2026-09-20')
  })

  it('leaves a Monday where it is', () => {
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14')
    expect(endOfWeek('2026-09-14')).toBe('2026-09-20')
  })

  it('handles midweek days', () => {
    expect(startOfWeek('2026-09-17')).toBe('2026-09-14')
    expect(endOfWeek('2026-09-17')).toBe('2026-09-20')
  })

  it('spans a month boundary', () => {
    expect(startOfWeek('2026-10-01')).toBe('2026-09-28')
    expect(endOfWeek('2026-09-28')).toBe('2026-10-04')
  })

  it('always covers exactly seven days', () => {
    for (const day of ['2026-01-01', '2026-03-29', '2026-10-25', '2024-02-29']) {
      expect(startOfWeek(endOfWeek(day))).toBe(startOfWeek(day))
    }
  })
})

describe('addWeeks', () => {
  it('steps whole weeks in both directions', () => {
    expect(addWeeks('2026-09-14', 1)).toBe('2026-09-21')
    expect(addWeeks('2026-09-14', -2)).toBe('2026-08-31')
  })
})

describe('startOfMonth / endOfMonth', () => {
  it('finds the first and last day', () => {
    expect(startOfMonth('2026-09-20')).toBe('2026-09-01')
    expect(endOfMonth('2026-09-20')).toBe('2026-09-30')
  })

  it('knows month lengths, including February in a leap year', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29')
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31')
  })
})

describe('addMonths', () => {
  it('steps months in both directions', () => {
    expect(addMonths('2026-09-15', 1)).toBe('2026-10-15')
    expect(addMonths('2026-09-15', -1)).toBe('2026-08-15')
  })

  it('crosses the year boundary', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('clamps to the last day when the target month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })
})

describe('isSameMonth', () => {
  it('compares month and year', () => {
    expect(isSameMonth('2026-09-01', '2026-09-30')).toBe(true)
    expect(isSameMonth('2026-09-30', '2026-10-01')).toBe(false)
    expect(isSameMonth('2025-09-15', '2026-09-15')).toBe(false)
  })
})

describe('monthGrid', () => {
  it('returns whole Monday-start weeks', () => {
    const grid = monthGrid('2026-09-20')
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid[0][0]).toBe('2026-08-31') // the Monday before 1 September
    expect(grid.at(-1)?.at(-1)).toBe('2026-10-04')
  })

  it('includes every day of the month exactly once', () => {
    const days = monthGrid('2026-09-20').flat()
    const september = days.filter((day) => day.startsWith('2026-09'))
    expect(september).toHaveLength(30)
    expect(new Set(september).size).toBe(30)
  })

  it('handles a month that starts on a Monday without a leading week', () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid('2026-06-15')[0][0]).toBe('2026-06-01')
  })

  it('handles February in a leap year', () => {
    const days = monthGrid('2024-02-10').flat()
    expect(days.filter((day) => day.startsWith('2024-02'))).toHaveLength(29)
  })
})

describe('weekday labels', () => {
  it('returns seven initials starting on Monday', () => {
    const initials = weekdayInitials()
    expect(initials).toHaveLength(7)
    expect(initials[0]).toBe(new Date(2026, 0, 5).toLocaleDateString(undefined, { weekday: 'narrow' }))
  })

  it('names the weekday of a date', () => {
    expect(weekdayShort('2026-09-14', 'en-GB')).toBe('Mon')
    // 14 September 2026 is a Monday in every locale; only the spelling moves.
    expect(weekdayShort('2026-09-14', 'de-DE')).toBe('Mo')
  })
})

describe('formatting', () => {
  it('collapses the month when a week sits inside one', () => {
    // Pinned locale: the month abbreviation differs between en-GB and en-US,
    // and CI does not run in the same locale as a developer laptop.
    expect(formatWeekRange('2026-09-16', 'en-GB')).toBe('14 – 20 Sept 2026')
  })

  it('keeps both months when a week spans two', () => {
    expect(formatWeekRange('2026-10-01', 'en-GB')).toBe('28 Sept – 4 Oct 2026')
  })

  it('keeps both years when a week spans the new year', () => {
    expect(formatWeekRange('2026-12-31', 'en-GB')).toBe('28 Dec 2026 – 3 Jan 2027')
  })

  it('formats in whatever locale it is given', () => {
    expect(formatWeekRange('2026-09-16', 'en-US')).toBe('14 – Sep 20, 2026')
  })

  it('names the current and neighbouring weeks', () => {
    expect(formatWeekLabel('2026-09-16', '2026-09-20')).toBe('This week')
    expect(formatWeekLabel('2026-09-09', '2026-09-20')).toBe('Last week')
    expect(formatWeekLabel('2026-09-23', '2026-09-20')).toBe('Next week')
    expect(formatWeekLabel('2026-07-01', '2026-09-20', 'en-GB')).toBe('29 Jun – 5 Jul 2026')
  })

  it('names the current and previous months', () => {
    expect(formatMonthTitle('2026-09-05', '2026-09-20')).toBe('This month')
    expect(formatMonthTitle('2026-08-05', '2026-09-20')).toBe('Last month')
    expect(formatMonthTitle('2026-03-05', '2026-09-20', 'en-GB')).toBe('March 2026')
  })

  it('formats a month and year', () => {
    expect(formatMonthLabel('2026-09-20', 'en-GB')).toBe('September 2026')
  })
})
