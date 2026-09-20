import type { ActivityByDate, DayActivity } from './types'
import type { DateKey } from './date'
import { isValidDateKey } from './date'

/**
 * Parsing for step data arriving from an iOS Shortcut.
 *
 * A PWA cannot read HealthKit — there is no web API for it — so the only way
 * step counts reach the app is being pushed in from outside. The Shortcut
 * builds a URL and opens it; this module turns that URL's payload back into
 * days. The format is deliberately plain text rather than JSON, because
 * assembling it in Shortcuts is a single Text action.
 *
 *   #/activity/import?days=2026-09-20:8421,2026-09-19:10233
 */

export const MAX_PLAUSIBLE_STEPS = 200_000

export interface ParsedDay {
  date: DateKey
  steps: number
}

export interface ParseResult {
  days: ParsedDay[]
  /** Entries that were dropped, with the reason, so the UI can be honest. */
  rejected: { raw: string; reason: string }[]
}

export function parseStepsPayload(payload: string | null): ParseResult {
  const days: ParsedDay[] = []
  const rejected: ParseResult['rejected'] = []
  if (!payload) return { days, rejected }

  const seen = new Set<string>()

  for (const chunk of payload.split(',')) {
    const raw = chunk.trim()
    if (raw === '') continue

    const [datePart, stepsPart] = raw.split(':')
    const date = (datePart ?? '').trim()
    const steps = Number.parseInt((stepsPart ?? '').trim(), 10)

    if (!isValidDateKey(date)) {
      rejected.push({ raw, reason: 'not a valid date' })
      continue
    }
    if (!Number.isFinite(steps) || steps < 0) {
      rejected.push({ raw, reason: 'step count is not a number' })
      continue
    }
    if (steps > MAX_PLAUSIBLE_STEPS) {
      // Almost always a Shortcut sending a distance or a duration by mistake.
      rejected.push({ raw, reason: 'step count is implausibly high' })
      continue
    }
    if (seen.has(date)) {
      rejected.push({ raw, reason: 'duplicate date' })
      continue
    }

    seen.add(date)
    days.push({ date, steps })
  }

  return { days, rejected }
}

/** Merge imported days over what is stored. A later import wins. */
export function mergeActivity(
  existing: ActivityByDate,
  days: ParsedDay[],
  source: DayActivity['source'],
  now: string = new Date().toISOString(),
): ActivityByDate {
  if (days.length === 0) return existing
  const next = { ...existing }
  for (const day of days) {
    next[day.date] = { date: day.date, steps: day.steps, source, updatedAt: now }
  }
  return next
}

export function stepsOn(activity: ActivityByDate, date: DateKey): number | null {
  const day = activity[date]
  return day ? day.steps : null
}

export interface StepSummary {
  /** Days in range that have a recorded count. */
  recordedDays: number
  totalDays: number
  totalSteps: number
  /** Mean over RECORDED days — blank days would drag it down misleadingly. */
  averageSteps: number
  daysOnTarget: number
}

export function summariseSteps(
  activity: ActivityByDate,
  dates: DateKey[],
  target: number,
): StepSummary {
  const recorded = dates
    .map((date) => activity[date])
    .filter((day): day is DayActivity => day !== undefined)

  const totalSteps = recorded.reduce((total, day) => total + day.steps, 0)

  return {
    recordedDays: recorded.length,
    totalDays: dates.length,
    totalSteps,
    averageSteps: recorded.length > 0 ? Math.round(totalSteps / recorded.length) : 0,
    daysOnTarget: target > 0 ? recorded.filter((day) => day.steps >= target).length : 0,
  }
}
