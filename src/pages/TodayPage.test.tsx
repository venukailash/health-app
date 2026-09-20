import { screen } from '@testing-library/react'
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
    expect(screen.getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
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

  it('removes an entry from the day when its remove button is used', async () => {
    const user = userEvent.setup()
    renderDay('2026-09-20')

    await user.click(screen.getByRole('button', { name: 'Remove Porridge oats' }))
    expect(screen.queryByText('Porridge oats')).not.toBeInTheDocument()
    expect(screen.getByText('330')).toBeInTheDocument()
  })

  it('links to the previous and next day', () => {
    renderDay('2026-09-20')
    expect(screen.getByRole('link', { name: /Yesterday/ })).toHaveAttribute(
      'href',
      '/day/2026-09-19',
    )
    expect(screen.getByRole('link', { name: /Tomorrow/ })).toHaveAttribute(
      'href',
      '/day/2026-09-21',
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
