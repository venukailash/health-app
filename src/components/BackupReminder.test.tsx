import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TodayPage from '../pages/TodayPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, logFood } from '../state/factories'
import { DEFAULT_GOALS, DEFAULT_META } from '../storage/repository'
import type { Meta } from '../storage/repository'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 0, protein: 11, salt: 0.02 },
})

const TODAY = '2026-10-10'
const LONG_AGO = '2026-08-01'

function renderToday(meta: Partial<Meta> = {}) {
  return renderWithApp(<TodayPage />, {
    path: '/day/:date',
    route: `/day/${TODAY}`,
    state: {
      goals: DEFAULT_GOALS,
      foods: [oats],
      meta: { ...DEFAULT_META, ...meta },
      log: { [LONG_AGO]: [logFood(oats, 50, 'breakfast', LONG_AGO)] },
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the backup reminder on Today', () => {
  function pinToday() {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 10, 9, 0))
  }

  it('asks for a backup once the data has gone long enough without one', () => {
    pinToday()
    renderToday()
    expect(screen.getByRole('heading', { name: 'Time to back up' })).toBeInTheDocument()
    expect(screen.getByText(/never backed it up/)).toBeInTheDocument()
  })

  it('stays out of the way while the backup is recent', () => {
    pinToday()
    renderToday({ lastBackupAt: '2026-10-08T09:00:00.000Z' })
    expect(screen.queryByRole('heading', { name: 'Time to back up' })).not.toBeInTheDocument()
  })

  it('stays away for good once never is chosen', async () => {
    pinToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()

    await user.click(screen.getByRole('button', { name: 'Never remind me' }))
    expect(screen.queryByRole('heading', { name: 'Time to back up' })).not.toBeInTheDocument()
  })

  it('hides until later when later is chosen', async () => {
    pinToday()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()

    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('heading', { name: 'Time to back up' })).not.toBeInTheDocument()
  })

  it('clears itself by taking the backup', async () => {
    pinToday()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:backup'),
      revokeObjectURL: vi.fn(),
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToday()

    await user.click(screen.getByRole('button', { name: 'Back up now' }))

    expect(click).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Time to back up' })).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
