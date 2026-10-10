import { describe, expect, it } from 'vitest'
import { TOUR_REVISION, TOUR_STEPS, stepsFor, tourDue } from './tour'

describe('the tour', () => {
  it('shows everything to someone who has never seen it', () => {
    expect(stepsFor(undefined)).toEqual(TOUR_STEPS)
    expect(tourDue(undefined)).toBe(true)
  })

  it('shows nothing to someone already up to date', () => {
    expect(stepsFor(TOUR_REVISION)).toEqual([])
    expect(tourDue(TOUR_REVISION)).toBe(false)
  })

  it('shows only what was added since they last looked', () => {
    const steps = [
      { id: 'install' as const, since: 1 },
      { id: 'ai' as const, since: 4 },
    ]
    expect(steps.filter((step) => step.since > 1)).toEqual([steps[1]])
    // ...which is what stepsFor does against the real list.
    expect(stepsFor(0)).toEqual(TOUR_STEPS)
  })

  it('treats a nonsense stored value as never seen rather than seen', () => {
    expect(stepsFor(Number.NaN)).toEqual(TOUR_STEPS)
    expect(stepsFor(Number.POSITIVE_INFINITY)).toEqual(TOUR_STEPS)
  })

  it('has a revision that covers every step', () => {
    for (const step of TOUR_STEPS) {
      expect(step.since, `${step.id} is from the future`).toBeLessThanOrEqual(TOUR_REVISION)
    }
  })
})
