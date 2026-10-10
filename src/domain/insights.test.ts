import { describe, expect, it } from 'vitest'
import { canGenerate, insightKey, type Insight } from './insights'

const insight = (generatedOn: string): Insight => ({
  scope: 'week',
  periodKey: '2026-10-05',
  generatedOn,
  headline: 'A steady week',
  points: [],
  advice: [],
})

describe('insightKey', () => {
  it('separates the same date in different scopes', () => {
    expect(insightKey('day', '2026-10-05')).not.toBe(insightKey('week', '2026-10-05'))
  })
})

describe('canGenerate', () => {
  it('allows the first reading of a period', () => {
    expect(canGenerate(undefined, '2026-10-10')).toBe(true)
  })

  it('refuses a second reading on the same day', () => {
    expect(canGenerate(insight('2026-10-10'), '2026-10-10')).toBe(false)
  })

  it('allows another reading on a later day, when there is new data to read', () => {
    expect(canGenerate(insight('2026-10-09'), '2026-10-10')).toBe(true)
  })
})
