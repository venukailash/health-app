import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ActivityPage from './ActivityPage'
import ActivityImportPage from './ActivityImportPage'
import { renderWithApp } from '../test/renderWithApp'
import type { ActivityByDate } from '../domain/types'
import { todayKey, addDays } from '../domain/date'

const today = todayKey()

const activity: ActivityByDate = {
  [today]: { date: today, steps: 12000, source: 'shortcut', updatedAt: 'now' },
  [addDays(today, -1)]: { date: addDays(today, -1), steps: 4000, source: 'manual', updatedAt: 'now' },
}

const render = () =>
  renderWithApp(<ActivityPage />, {
    path: '/activity',
    route: '/activity',
    state: { activity, activityGoals: { steps: 10000 } },
  })

describe('ActivityPage', () => {
  it("shows today's steps against the target", () => {
    render()
    expect(screen.getByText(/12,000 \/ 10,000/)).toBeInTheDocument()
  })

  it('marks the target as met for assistive technology', () => {
    render()
    expect(screen.getByRole('progressbar', { name: /Steps: 120% of target/ })).toBeInTheDocument()
  })

  it('averages over recorded days rather than the whole week', () => {
    render()
    // 12000 + 4000 over 2 recorded days = 8000, not spread across seven.
    expect(screen.getByRole('progressbar', { name: /Weekly average: 80% of target/ })).toBeInTheDocument()
  })

  it('labels where each count came from', () => {
    render()
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('lets a count be added by hand', async () => {
    const user = userEvent.setup()
    renderWithApp(<ActivityPage />, {
      path: '/activity',
      route: '/activity',
      state: { activity: {}, activityGoals: { steps: 10000 } },
    })

    await user.type(screen.getByLabelText('Steps'), '7500')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Today's own bar, not the weekly average (which with a single recorded
    // day happens to show the same number).
    expect(screen.getByRole('progressbar', { name: 'Steps: 75% of target' })).toBeInTheDocument()
  })

  it('removes a count', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: `Remove steps for ${today}` }))
    expect(screen.getByText('Not recorded')).toBeInTheDocument()
  })

  it('offers setup guidance when nothing has been recorded', () => {
    renderWithApp(<ActivityPage />, {
      path: '/activity',
      route: '/activity',
      state: { activity: {}, activityGoals: { steps: 10000 } },
    })
    expect(screen.getByText('No step counts yet')).toBeInTheDocument()
  })
})

describe('ActivityImportPage', () => {
  const renderImport = (search: string) =>
    renderWithApp(<ActivityImportPage />, {
      path: '/activity/import',
      route: `/activity/import${search}`,
      state: { activity: {}, activityGoals: { steps: 10000 } },
    })

  it('imports a batch of days', () => {
    renderImport('?days=2026-09-20:8421,2026-09-19:10233')
    expect(screen.getByText(/Imported 2 days/)).toBeInTheDocument()
  })

  it('accepts the simpler single-day form a Shortcut is likely to build', () => {
    renderImport('?steps=8421&date=2026-09-20')
    expect(screen.getByText(/Imported 1 day/)).toBeInTheDocument()
  })

  it('reports what it rejected instead of failing silently', () => {
    renderImport('?days=not-a-date:100')
    expect(screen.getByText('Nothing could be imported')).toBeInTheDocument()
    expect(screen.getByText(/not a valid date/)).toBeInTheDocument()
  })

  it('explains an empty link rather than looking broken', () => {
    renderImport('')
    expect(screen.getByText(/carried no step data/)).toBeInTheDocument()
  })

  it('says how many were skipped when only some were bad', () => {
    renderImport('?days=2026-09-20:8421,rubbish')
    expect(screen.getByText(/Imported 1 day/)).toBeInTheDocument()
    expect(screen.getByText(/1 entry was skipped/)).toBeInTheDocument()
  })
})
