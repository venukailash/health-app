/**
 * Which parts of the tour a given person still has to see.
 *
 * The tour is versioned by its OWN revision, not by the app's. This app
 * deploys several times a day; re-running a five-step tour after every deploy
 * would be a punishment for keeping the app up to date. Bump TOUR_REVISION by
 * hand when a step is added or rewritten, and give the new step that revision
 * as its `since` — people who have seen the rest are then shown only what
 * changed, and people who have seen everything are shown nothing.
 */

export const TOUR_REVISION = 1

export interface TourStep {
  id: TourStepId
  since: number
  /**
   * Where the card has to be before it makes sense. `:today` stands in for the
   * current date so the list stays plain, comparable data.
   */
  route?: string
  /**
   * The `data-tour` value of the thing the card is talking about. The step
   * still works without one — the first card is about the browser's own
   * install menu, which no amount of pointing can reach.
   */
  anchor?: string
}

export type TourStepId = 'install' | 'foodKey' | 'geminiKey' | 'ai' | 'targets' | 'log'

export const TOUR_STEPS: TourStep[] = [
  { id: 'install', since: 1 },
  { id: 'foodKey', since: 1, route: '/settings/app', anchor: 'fdc-key' },
  { id: 'geminiKey', since: 1, route: '/settings/app', anchor: 'gemini-key' },
  { id: 'ai', since: 1, route: '/day/:today', anchor: 'quick-add' },
  { id: 'targets', since: 1, route: '/settings/targets', anchor: 'daily-targets' },
  { id: 'log', since: 1, route: '/day/:today', anchor: 'add-to-meal' },
]

/** Fills in the one placeholder a route may carry. */
export function tourRoute(step: TourStep, today: string): string | undefined {
  return step.route?.replace(':today', today)
}

/**
 * `seen` is the revision this device has already been through; absent means
 * it has never seen any of it, which is the first run.
 */
export function stepsFor(seen: number | undefined): TourStep[] {
  if (seen === undefined) return TOUR_STEPS
  if (!Number.isFinite(seen)) return TOUR_STEPS
  return TOUR_STEPS.filter((step) => step.since > seen)
}

export function tourDue(seen: number | undefined): boolean {
  return stepsFor(seen).length > 0
}
