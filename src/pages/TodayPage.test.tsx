import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TodayPage from './TodayPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, logFood } from '../state/factories'
import { DEFAULT_GOALS } from '../storage/repository'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 0, protein: 11, salt: 0.02 },
})
const chicken = createFood({
  name: 'Chicken breast',
  per100g: { kcal: 165, fat: 3.6, satFat: 1, carbs: 0, fibre: 0, protein: 31, salt: 0.1 },
})

const state = {
  foods: [oats, chicken],
  goals: DEFAULT_GOALS,
  log: {
    '2026-09-20': [
      logFood(oats, 100, 'breakfast', '2026-09-20'),
      logFood(chicken, 200, 'lunch', '2026-09-20'),
    ],
    '2026-09-19': [logFood(oats, 500, 'dinner', '2026-09-19')],
  },
}

afterEach(() => {
  vi.useRealTimers()
})

const renderDay = (date: string) =>
  renderWithApp(<TodayPage />, { path: '/day/:date', route: `/day/${date}`, state })

describe('TodayPage', () => {
  it('totals only the selected day', () => {
    renderDay('2026-09-20')
    // 379 + 330, not the 1895 kcal logged the day before.
    expect(screen.getByText('709')).toBeInTheDocument()
    expect(screen.queryByText('1895')).not.toBeInTheDocument()
  })

  it('shows a different day when the date changes', () => {
    renderDay('2026-09-19')
    expect(screen.getByText('1895')).toBeInTheDocument()
  })

  it('shows zeros for a day with nothing logged', () => {
    renderDay('2026-09-18')
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('2000 kcal left')).toBeInTheDocument()
  })

  it('groups entries under their meal with a subtotal', () => {
    renderDay('2026-09-20')
    // The heading now carries the meal's totals as well as its name.
    expect(screen.getByRole('heading', { name: /^Breakfast/ })).toBeInTheDocument()
    expect(screen.getByText('Porridge oats')).toBeInTheDocument()
    expect(screen.getByText('Chicken breast')).toBeInTheDocument()
    // Appears twice: the meal subtotal in the header and the entry itself.
    expect(screen.getAllByText('379 kcal')).toHaveLength(2)
  })

  it('reports each macro as a percentage of goal', () => {
    renderDay('2026-09-20')
    // 73 g protein against a 50 g target.
    expect(screen.getByRole('progressbar', { name: /Protein: 146% of goal/ })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Carbs: 23% of goal/ })).toBeInTheDocument()
  })

  it('breaks fat down into saturated and unsaturated', () => {
    renderDay('2026-09-20')
    expect(screen.getByText(/15\.2 g fat today, 3\.4 g is saturated/)).toBeInTheDocument()
    expect(screen.getByText(/11\.8 g unsaturated/)).toBeInTheDocument()
  })

  it('removes an entry only after the removal is confirmed', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: 'Remove Porridge oats' }))
    // The first tap arms the row; nothing has gone yet.
    expect(screen.getByText('Porridge oats')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm removing Porridge oats' }))
    expect(screen.queryByText('Porridge oats')).not.toBeInTheDocument()
    expect(screen.getByText('330')).toBeInTheDocument()
  })

  it('arms only the row that was tapped', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: 'Remove Porridge oats' }))
    await user.click(screen.getByRole('button', { name: 'Remove Chicken breast' }))

    expect(
      screen.queryByRole('button', { name: 'Confirm removing Porridge oats' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirm removing Chicken breast' }),
    ).toBeInTheDocument()
  })

  it('disarms a row that is left alone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: 'Remove Porridge oats' }))
    expect(
      screen.getByRole('button', { name: 'Confirm removing Porridge oats' }),
    ).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByRole('button', { name: 'Remove Porridge oats' })).toBeInTheDocument()
    expect(screen.getByText('Porridge oats')).toBeInTheDocument()
  })

  it('links to the previous and next day', () => {
    // The neighbour links are labelled relative to the real today, so the
    // clock is pinned: otherwise this passes only during the week the fixture
    // dates happen to be current.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 20, 9, 0))

    renderDay('2026-09-20')

    expect(screen.getByRole('link', { name: /Yesterday/ })).toHaveAttribute(
      'href',
      '/day/2026-09-19',
    )
    // Viewing today, so the step forward is shown but goes nowhere: there is
    // nothing to log tomorrow.
    expect(screen.queryByRole('link', { name: /Tomorrow/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Tomorrow/)).toHaveAttribute('aria-disabled', 'true')
  })

  it('lets you step forward from a past day, as far as today', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 20, 9, 0))

    renderDay('2026-09-18')

    expect(screen.getByRole('link', { name: /Yesterday/ })).toHaveAttribute(
      'href',
      '/day/2026-09-19',
    )
  })

  it('redirects a malformed date to today', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 20, 9, 0))

    renderWithApp(<TodayPage />, { path: '/day/:date', route: '/day/not-a-date', state })

    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('709')).toBeInTheDocument()
  })
})

describe('TodayPage — per-meal breakdown', () => {
  it("shows each meal's calories and its share of the day", () => {
    renderDay('2026-09-20')
    // Breakfast is 379 kcal against a 2000 kcal goal.
    const breakfast = screen.getByRole('button', { name: /Breakfast/ })
    expect(breakfast).toHaveTextContent('379 kcal')
    expect(breakfast).toHaveTextContent('19%')
  })

  it('keeps the breakdown collapsed until asked', () => {
    renderDay('2026-09-20')
    expect(screen.getByRole('button', { name: /Breakfast/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('Share of your daily targets')).not.toBeInTheDocument()
  })

  it('expands to the macro split for that meal alone', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: /Breakfast/ }))

    expect(screen.getByRole('button', { name: /Breakfast/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    // Scope to the breakfast card: the day summary above shows its own bars,
    // and here they happen to carry the same carb figure.
    const breakfast = screen
      .getByRole('button', { name: /Breakfast/ })
      .closest('section') as HTMLElement

    // 60 g carbs from breakfast against the 260 g daily target.
    expect(
      within(breakfast).getByRole('progressbar', { name: /Carbs: 23% of goal/ }),
    ).toBeInTheDocument()
    // Breakfast's own protein, not the day's: 11 g against the 50 g target.
    expect(
      within(breakfast).getByRole('progressbar', { name: /Protein: 22% of goal/ }),
    ).toBeInTheDocument()
  })

  it('collapses again', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: /Breakfast/ }))
    await user.click(screen.getByRole('button', { name: /Breakfast/ }))
    expect(screen.queryByText('Share of your daily targets')).not.toBeInTheDocument()
  })

  it('opens each meal independently', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: /Breakfast/ }))
    expect(screen.getByRole('button', { name: /Lunch/ })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: /Lunch/ }))
    expect(screen.getAllByText('Share of your daily targets')).toHaveLength(2)
  })

  it('offers nothing to expand on an empty meal', () => {
    renderDay('2026-09-20')
    // Dinner has no entries, so there is no breakdown behind it.
    expect(screen.queryByRole('button', { name: /Dinner/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dinner' })).toBeInTheDocument()
  })

  it('measures the meal against the daily target, not the day so far', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: /Lunch/ }))
    const lunch = screen.getByRole('button', { name: /Lunch/ }).closest('section') as HTMLElement

    // Lunch is 62 g protein against the 50 g DAILY target, so it reads as over
    // on its own — not as a share of what has been eaten today.
    expect(
      within(lunch).getByRole('progressbar', { name: /Protein: 124% of goal/ }),
    ).toBeInTheDocument()
  })
})
