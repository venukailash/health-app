/**
 * All date keys are LOCAL calendar dates. Deriving them from toISOString()
 * is the classic bug that files a 9pm entry under tomorrow for anyone east
 * of UTC, so every conversion here goes through local getters.
 */

export type DateKey = string // 'YYYY-MM-DD'

const pad = (value: number): string => String(value).padStart(2, '0')

export function toDateKey(date: Date = new Date()): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

/** Parse 'YYYY-MM-DD' into a Date at local midnight. */
export function fromDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  return toDateKey(fromDateKey(key)) === key
}

/**
 * Add days to a date key. Uses local midday internally so a DST transition
 * can never push the result onto the wrong calendar day.
 */
export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function diffInDays(from: DateKey, to: DateKey): number {
  const a = fromDateKey(from)
  const b = fromDateKey(to)
  a.setHours(12, 0, 0, 0)
  b.setHours(12, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Inclusive list of date keys from `from` to `to`. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const total = diffInDays(from, to)
  if (total < 0) return []
  return Array.from({ length: total + 1 }, (_, index) => addDays(from, index))
}

/** 'Today', 'Yesterday', 'Tomorrow', or e.g. 'Mon 14 Sep'. */
export function formatDayLabel(key: DateKey, today: DateKey = todayKey()): string {
  const offset = diffInDays(today, key)
  if (offset === 0) return 'Today'
  if (offset === -1) return 'Yesterday'
  if (offset === 1) return 'Tomorrow'
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: Math.abs(offset) > 300 ? 'numeric' : undefined,
  })
}

export function formatFullDate(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/* Weeks and months                                                     */
/* ------------------------------------------------------------------ */

/** Weeks run Monday to Sunday (ISO / UK convention). */
export function startOfWeek(key: DateKey): DateKey {
  const day = fromDateKey(key).getDay() // 0 = Sunday
  const backToMonday = day === 0 ? 6 : day - 1
  return addDays(key, -backToMonday)
}

export function endOfWeek(key: DateKey): DateKey {
  return addDays(startOfWeek(key), 6)
}

export function addWeeks(key: DateKey, weeks: number): DateKey {
  return addDays(key, weeks * 7)
}

export function startOfMonth(key: DateKey): DateKey {
  const date = fromDateKey(key)
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonth(key: DateKey): DateKey {
  const date = fromDateKey(key)
  // Day 0 of the next month is the last day of this one.
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

/** Step whole months, clamping to the last day when the target is shorter. */
export function addMonths(key: DateKey, months: number): DateKey {
  const date = fromDateKey(key)
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return toDateKey(target)
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/**
 * The calendar grid for a month: whole Monday-start weeks covering it, with
 * leading and trailing days from the neighbouring months so every row is full.
 */
export function monthGrid(key: DateKey): DateKey[][] {
  const first = startOfWeek(startOfMonth(key))
  const last = endOfWeek(endOfMonth(key))
  const days = dateRange(first, last)
  return Array.from({ length: days.length / 7 }, (_, week) =>
    days.slice(week * 7, week * 7 + 7),
  )
}

/** Short weekday initials in Monday-first order, e.g. M T W T F S S. */
export function weekdayInitials(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    // 2026-01-05 was a Monday; any known Monday works as the anchor.
    const date = new Date(2026, 0, 5 + index)
    return date.toLocaleDateString(undefined, { weekday: 'narrow' })
  })
}

export function weekdayShort(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short' })
}

/** e.g. '14 – 20 Sep 2026', collapsing repeated month and year. */
export function formatWeekRange(key: DateKey): string {
  const from = fromDateKey(startOfWeek(key))
  const to = fromDateKey(endOfWeek(key))
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  const sameYear = from.getFullYear() === to.getFullYear()

  const left = from.toLocaleDateString(undefined, {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
    year: sameYear ? undefined : 'numeric',
  })
  const right = to.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${left} – ${right}`
}

export function formatMonthLabel(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** 'This week' / 'Last week' / the date range. */
export function formatWeekLabel(key: DateKey, today: DateKey = todayKey()): string {
  const weeks = Math.round(diffInDays(startOfWeek(today), startOfWeek(key)) / 7)
  if (weeks === 0) return 'This week'
  if (weeks === -1) return 'Last week'
  if (weeks === 1) return 'Next week'
  return formatWeekRange(key)
}

/** 'This month' / 'Last month' / the month name. */
export function formatMonthTitle(key: DateKey, today: DateKey = todayKey()): string {
  if (isSameMonth(key, today)) return 'This month'
  if (isSameMonth(key, addMonths(today, -1))) return 'Last month'
  return formatMonthLabel(key)
}
