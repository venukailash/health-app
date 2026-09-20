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
