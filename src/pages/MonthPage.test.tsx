import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MonthPage from './MonthPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, logFood } from '../state/factories'
import { DEFAULT_GOALS } from '../storage/repository'
import type { AppState } from '../state/reducer'

const food = createFood({
  name: 'Test food',
  per100g: { kcal: 100, fat: 10, satFat: 4, carbs: 20, fibre: 0, protein: 5, salt: 1 },
})

const day = (date: string, kcal: number) => logFood(food, kcal, 'breakfast', date)

const state: Partial<AppState> = {
  foods: [food],
  goals: DEFAULT_GOALS,
  log: {
    '2026-09-01': [day('2026-09-01', 1800)],
    '2026-09-02': [day('2026-09-02', 2600)],
    '2026-09-20': [day('2026-09-20', 1600)],
    // Neighbouring months, which must not be counted.
    '2026-08-31': [day('2026-08-31', 9999)],
    '2026-10-01': [day('2026-10-01', 9999)],
  },
}

afterEach(() => {
  vi.useRealTimers()
})

const renderMonth = (date: string, overrides: Partial<AppState> = {}) =>
  renderWithApp(<MonthPage />, {
    path: '/month/:date',
    route: `/month/${date}`,
    state: { ...state, ...overrides },
  })

describe('MonthPage', () => {
  it('shows the month containing the given date', () => {
    renderMonth('2026-09-17')
    // Asserted through the day links: the rendered month name is
    // locale-dependent, so it differs between a laptop and CI.
    const calendar = screen.getAllByRole('figure')[0]
    expect(within(calendar).getByRole('link', { name: /^2026-09-01:/ })).toBeInTheDocument()
    expect(within(calendar).getByRole('link', { name: /^2026-09-30:/ })).toBeInTheDocument()
    expect(within(calendar).queryByRole('link', { name: /^2026-08-31:/ })).not.toBeInTheDocument()
    expect(within(calendar).queryByRole('link', { name: /^2026-10-01:/ })).not.toBeInTheDocument()
  })

  it('renders a calendar cell for every day of the month', () => {
    renderMonth('2026-09-17')
    const calendar = screen.getAllByRole('figure')[0]
    expect(within(calendar).getAllByRole('link')).toHaveLength(30)
  })

  it('averages only the days logged in this month', () => {
    renderMonth('2026-09-17')
    // (1800 + 2600 + 1600) / 3 = 2000. Neighbouring months are excluded.
    expect(screen.getByText('2000')).toBeInTheDocument()
    expect(screen.getByText('3/30')).toBeInTheDocument()
  })

  it('counts days at or under the calorie goal', () => {
    renderMonth('2026-09-17')
    // 1800 and 1600 are under 2000; 2600 is not.
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('links to the previous and next month', () => {
    renderMonth('2026-09-17')
    expect(screen.getByRole('link', { name: /←/ })).toHaveAttribute('href', '/month/2026-08-01')
    expect(screen.getByRole('link', { name: /→/ })).toHaveAttribute('href', '/month/2026-10-01')
  })

  it('offers the day and week views for the same date', () => {
    renderMonth('2026-09-17')
    expect(screen.getByRole('tab', { name: 'Day' })).toHaveAttribute('href', '/day/2026-09-17')
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('href', '/week/2026-09-17')
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')
  })

  it('reveals a table of the logged days on request', async () => {
    const user = userEvent.setup()
    renderMonth('2026-09-17')

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show table' }))

    const table = screen.getByRole('table')
    // One row per logged day, plus the header row.
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(within(table).getByRole('rowheader', { name: '2026-09-02' })).toBeInTheDocument()
    expect(within(table).getByText('130%')).toBeInTheDocument()
  })

  it('hides the table again', async () => {
    const user = userEvent.setup()
    renderMonth('2026-09-17')

    await user.click(screen.getByRole('button', { name: 'Show table' }))
    await user.click(screen.getByRole('button', { name: 'Hide table' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('still shows the calendar when nothing was logged that month', () => {
    renderMonth('2026-12-10')
    expect(screen.getByText('Nothing logged this month')).toBeInTheDocument()
    expect(screen.getAllByRole('figure')[0]).toBeInTheDocument()
  })

  it('redirects a malformed date to the current month', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 20, 9, 0))

    renderWithApp(<MonthPage />, { path: '/month/:date', route: '/month/nope', state })

    expect(screen.getByRole('heading', { name: 'This month' })).toBeInTheDocument()
  })
})
