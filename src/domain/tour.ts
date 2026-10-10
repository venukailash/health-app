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
}

export type TourStepId = 'install' | 'keys' | 'ai' | 'targets' | 'log'

export const TOUR_STEPS: TourStep[] = [
  { id: 'install', since: 1 },
  { id: 'keys', since: 1 },
  { id: 'ai', since: 1 },
  { id: 'targets', since: 1 },
  { id: 'log', since: 1 },
]

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
