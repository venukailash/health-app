import type { DateKey } from './date'

/**
 * A stored AI reading of one period's food log.
 *
 * Kept rather than recomputed, for two reasons. Gemini is metered, and the
 * same question about the same finished day has the same answer — asking
 * twice costs a request and risks a different reply for identical data, which
 * would make the feature look unreliable.
 */

export const INSIGHT_SCOPES = ['day', 'week', 'month'] as const
export type InsightScope = (typeof INSIGHT_SCOPES)[number]

export interface Insight {
  scope: InsightScope
  /** Day, start of week, or start of month — whichever this covers. */
  periodKey: DateKey
  /** The local date it was worked out, which is what paces re-runs. */
  generatedOn: DateKey
  headline: string
  /** What the data says. */
  points: string[]
  /** What to do about it. */
  advice: string[]
  caveat?: string
}

export type InsightsByKey = Record<string, Insight>

export function insightKey(scope: InsightScope, periodKey: DateKey): string {
  return `${scope}:${periodKey}`
}

/**
 * Whether a fresh reading is allowed right now.
 *
 * One per period per calendar day. A finished day therefore gets read once and
 * stays read; a week in progress can be looked at again tomorrow, when there
 * is actually something new in it. This is the rate limit, and it is deliberate
 * rather than a side effect of caching.
 */
export function canGenerate(existing: Insight | undefined, today: DateKey): boolean {
  return existing === undefined || existing.generatedOn !== today
}
