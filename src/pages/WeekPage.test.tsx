import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WeekPage from './WeekPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, logFood } from '../state/factories'
import { DEFAULT_GOALS } from '../storage/repository'
import type { AppState } from '../state/reducer'

const food = createFood({
  name: 'Test food',
  per100g: { kcal: 100, fat: 10, satFat: 4, carbs: 20, protein: 5, salt: 1 },
})

const day = (date: string, kcal: number) => logFood(food, kcal, 'breakfast', date)

const state: Partial<AppState> = {
  foods: [food],
  goals: DEFAULT_GOALS,
  log: {
    // Mon 14 and Tue 15 of the week 14–20 September 2026.
    '2026-09-14': [day('2026-09-14', 2000)],
    '2026-09-15': [day('2026-09-15', 1000)],
    // The week before, which must not leak in.
    '2026-09-13': [day('2026-09-13', 5000)],
  },
}

afterEach(() => {
  vi.useRealTimers()
})

const renderWeek = (date: string, overrides: Partial<AppState> = {}) =>
  renderWithApp(<WeekPage />, {
    path: '/week/:date',
    route: `/week/${date}`,
    state: { ...state, ...overrides },
  })

describe('WeekPage', () => {
  it('shows the Monday-to-Sunday week containing the given date', () => {
    renderWeek('2026-09-17')
    // Asserted through the day links rather than the formatted range, which
    // is locale-dependent and so differs between a laptop and CI.
    const list = screen.getByRole('heading', { name: 'Day by day' })
      .parentElement as HTMLElement
    const days = within(list).getAllByRole('link')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAttribute('href', '/day/2026-09-14')
    expect(days.at(-1)).toHaveAttribute('href', '/day/2026-09-20')
  })

  it('averages over logged days, not all seven', () => {
    renderWeek('2026-09-17')
    // 3000 kcal across 2 logged days = 1500, not 3000/7 = 429.
    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.queryByText('429')).not.toBeInTheDocument()
  })

  it('says how many days the average covers', () => {
    renderWeek('2026-09-17')
    expect(screen.getByText(/Averaged over the 2 days you logged, not all 7/)).toBeInTheDocument()
  })

  it('counts logged days and days on target', () => {
    renderWeek('2026-09-17')
    expect(screen.getByText('2/7')).toBeInTheDocument()
    // Both logged days are under the 2000 kcal goal (2000 counts as on target).
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })

  it('excludes days outside the week', () => {
    renderWeek('2026-09-17')
    expect(screen.queryByText('5000')).not.toBeInTheDocument()
  })

  it('lists every day of the week, marking the blank ones', () => {
    renderWeek('2026-09-17')
    const list = screen.getByRole('heading', { name: 'Day by day' }).parentElement as HTMLElement
    expect(within(list).getAllByText('Not logged')).toHaveLength(5)
  })

  it('links backwards and forwards a week', () => {
    renderWeek('2026-09-17')
    expect(screen.getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/week/2026-09-07',
    )
    expect(screen.getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/week/2026-09-21')
  })

  it('offers the day and month views for the same date', () => {
    renderWeek('2026-09-17')
    expect(screen.getByRole('tab', { name: 'Day' })).toHaveAttribute('href', '/day/2026-09-17')
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('href', '/month/2026-09-17')
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows an empty state for a week with nothing logged', () => {
    renderWeek('2026-10-14')
    expect(screen.getByText('Nothing logged this week')).toBeInTheDocument()
    expect(screen.queryByText('Day by day')).not.toBeInTheDocument()
  })

  it('redirects a malformed date to the current week', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 20, 9, 0))

    renderWithApp(<WeekPage />, { path: '/week/:date', route: '/week/nope', state })

    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
  })
})
