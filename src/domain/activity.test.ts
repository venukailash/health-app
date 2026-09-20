import { describe, expect, it } from 'vitest'
import {
  MAX_PLAUSIBLE_STEPS,
  mergeActivity,
  parseStepsPayload,
  stepsOn,
  summariseSteps,
} from './activity'
import type { ActivityByDate } from './types'

describe('parseStepsPayload', () => {
  it('parses a single day', () => {
    const { days, rejected } = parseStepsPayload('2026-09-20:8421')
    expect(days).toEqual([{ date: '2026-09-20', steps: 8421 }])
    expect(rejected).toEqual([])
  })

  it('parses several days', () => {
    const { days } = parseStepsPayload('2026-09-20:8421,2026-09-19:10233,2026-09-18:4102')
    expect(days).toHaveLength(3)
    expect(days[2]).toEqual({ date: '2026-09-18', steps: 4102 })
  })

  it('tolerates spacing and trailing separators', () => {
    const { days } = parseStepsPayload(' 2026-09-20 : 8421 , 2026-09-19:10233 , ')
    expect(days).toHaveLength(2)
  })

  it('returns nothing for an absent or empty payload', () => {
    expect(parseStepsPayload(null).days).toEqual([])
    expect(parseStepsPayload('').days).toEqual([])
  })

  it('rejects an invalid date rather than guessing', () => {
    const { days, rejected } = parseStepsPayload('20-09-2026:8421,2026-02-30:100')
    expect(days).toEqual([])
    expect(rejected).toHaveLength(2)
    expect(rejected[0].reason).toMatch(/valid date/)
  })

  it('rejects a non-numeric or negative count', () => {
    const { days, rejected } = parseStepsPayload('2026-09-20:lots,2026-09-19:-5')
    expect(days).toEqual([])
    expect(rejected).toHaveLength(2)
  })

  it('rejects an implausible count, which usually means the wrong Health type', () => {
    const { rejected } = parseStepsPayload(`2026-09-20:${MAX_PLAUSIBLE_STEPS + 1}`)
    expect(rejected[0].reason).toMatch(/implausibly high/)
  })

  it('keeps the first of a duplicated date', () => {
    const { days, rejected } = parseStepsPayload('2026-09-20:8421,2026-09-20:999')
    expect(days).toEqual([{ date: '2026-09-20', steps: 8421 }])
    expect(rejected[0].reason).toBe('duplicate date')
  })

  it('keeps the good entries when only some are bad', () => {
    const { days, rejected } = parseStepsPayload('2026-09-20:8421,rubbish,2026-09-19:100')
    expect(days).toHaveLength(2)
    expect(rejected).toHaveLength(1)
  })

  it('accepts zero steps, which is a real answer', () => {
    expect(parseStepsPayload('2026-09-20:0').days).toEqual([{ date: '2026-09-20', steps: 0 }])
  })
})

describe('mergeActivity', () => {
  const existing: ActivityByDate = {
    '2026-09-19': { date: '2026-09-19', steps: 100, source: 'manual', updatedAt: 'then' },
  }

  it('adds new days and keeps old ones', () => {
    const merged = mergeActivity(existing, [{ date: '2026-09-20', steps: 8421 }], 'shortcut', 'now')
    expect(Object.keys(merged).sort()).toEqual(['2026-09-19', '2026-09-20'])
    expect(merged['2026-09-20'].source).toBe('shortcut')
  })

  it('overwrites a day that is imported again', () => {
    const merged = mergeActivity(existing, [{ date: '2026-09-19', steps: 500 }], 'shortcut', 'now')
    expect(merged['2026-09-19']).toEqual({
      date: '2026-09-19',
      steps: 500,
      source: 'shortcut',
      updatedAt: 'now',
    })
  })

  it('does not mutate what it was given', () => {
    mergeActivity(existing, [{ date: '2026-09-20', steps: 1 }], 'shortcut', 'now')
    expect(Object.keys(existing)).toEqual(['2026-09-19'])
  })

  it('returns the original object when there is nothing to merge', () => {
    expect(mergeActivity(existing, [], 'shortcut')).toBe(existing)
  })
})

describe('stepsOn', () => {
  const activity: ActivityByDate = {
    '2026-09-20': { date: '2026-09-20', steps: 8421, source: 'shortcut', updatedAt: 'now' },
  }

  it('returns the count for a recorded day', () => {
    expect(stepsOn(activity, '2026-09-20')).toBe(8421)
  })

  it('distinguishes an unrecorded day from a zero-step day', () => {
    expect(stepsOn(activity, '2026-09-19')).toBeNull()
    const withZero: ActivityByDate = {
      '2026-09-19': { date: '2026-09-19', steps: 0, source: 'manual', updatedAt: 'now' },
    }
    expect(stepsOn(withZero, '2026-09-19')).toBe(0)
  })
})

describe('summariseSteps', () => {
  const activity: ActivityByDate = {
    '2026-09-14': { date: '2026-09-14', steps: 12000, source: 'shortcut', updatedAt: 'now' },
    '2026-09-15': { date: '2026-09-15', steps: 6000, source: 'shortcut', updatedAt: 'now' },
    '2026-09-16': { date: '2026-09-16', steps: 10000, source: 'shortcut', updatedAt: 'now' },
  }
  const week = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']

  it('averages over recorded days, not calendar days', () => {
    const summary = summariseSteps(activity, week, 10000)
    // 28000 over 3 recorded days = 9333, not 28000/5 = 5600.
    expect(summary.averageSteps).toBe(9333)
    expect(summary.recordedDays).toBe(3)
    expect(summary.totalDays).toBe(5)
  })

  it('totals every recorded day', () => {
    expect(summariseSteps(activity, week, 10000).totalSteps).toBe(28000)
  })

  it('counts days that met the target, inclusive', () => {
    expect(summariseSteps(activity, week, 10000).daysOnTarget).toBe(2)
  })

  it('reports zero rather than dividing by zero when nothing is recorded', () => {
    const summary = summariseSteps({}, week, 10000)
    expect(summary.averageSteps).toBe(0)
    expect(summary.daysOnTarget).toBe(0)
    expect(Number.isFinite(summary.averageSteps)).toBe(true)
  })

  it('counts no days on target when no target is set', () => {
    expect(summariseSteps(activity, week, 0).daysOnTarget).toBe(0)
  })

  it('ignores days outside the range it was given', () => {
    expect(summariseSteps(activity, ['2026-09-14'], 10000).totalSteps).toBe(12000)
  })
})
