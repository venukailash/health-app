import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AiInsights from './AiInsights'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, logFood } from '../state/factories'
import { DEFAULT_GOALS, DEFAULT_META } from '../storage/repository'
import { insightKey, type Insight } from '../domain/insights'
import type { AppState } from '../state/reducer'
import type { MealType } from '../domain/types'

const DATE = '2026-10-07'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 5, protein: 11, salt: 0.02 },
})

const reply = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))

const ANSWER = JSON.stringify({
  headline: 'A solid day, a little short on fibre.',
  points: ['You hit 94% of your calorie target.'],
  advice: ['A handful of berries would close the fibre gap.'],
  caveat: null,
})

const logged = (meals: MealType[]): Partial<AppState> => ({
  goals: DEFAULT_GOALS,
  foods: [oats],
  meta: { ...DEFAULT_META, geminiApiKey: 'key' },
  log: { [DATE]: meals.map((meal) => logFood(oats, 100, meal, DATE)) },
})

const render = (state: Partial<AppState>, scope: 'day' | 'week' | 'month' = 'day') =>
  renderWithApp(<AiInsights scope={scope} date={DATE} />, { state })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function pinToday() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 7, 9, 0))
}

describe('AI insights', () => {
  it('explains itself instead of asking, when a day is missing meals', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(logged(['breakfast', 'lunch']))

    // The reason lives in the panel, not in a line under the button: on a
    // small screen that line pushed the calorie ring off the bottom.
    await user.click(screen.getByRole('button', { name: /AI insights/ }))

    expect(await screen.findByText(/Log breakfast, lunch and dinner/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('names the reason in the button itself, for anyone not looking at it', () => {
    render(logged(['breakfast', 'lunch']))
    expect(
      screen.getByRole('button', { name: /AI insights — Log breakfast, lunch and dinner/ }),
    ).toBeInTheDocument()
  })

  it('is available on a week with a single logged day', () => {
    render(logged(['lunch']), 'week')
    expect(screen.getByRole('button', { name: 'AI insights' })).toBeInTheDocument()
  })

  it('reads the period and shows what came back', async () => {
    pinToday()
    vi.stubGlobal('fetch', vi.fn(async () => reply(ANSWER)))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(logged(['breakfast', 'lunch', 'dinner']))

    await user.click(screen.getByRole('button', { name: /AI insights/ }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/short on fibre/)).toBeInTheDocument()
    expect(within(dialog).getByText(/94% of your calorie target/)).toBeInTheDocument()
    expect(within(dialog).getByText(/handful of berries/)).toBeInTheDocument()
    expect(within(dialog).getByText(/not medical advice/)).toBeInTheDocument()
  })

  it('shows a stored reading without asking again', async () => {
    pinToday()
    const fetchMock = vi.fn(async () => reply(ANSWER))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    const stored: Insight = {
      scope: 'day',
      periodKey: DATE,
      generatedOn: DATE,
      headline: 'Read this already.',
      points: [],
      advice: [],
    }
    render({ ...logged(['breakfast', 'lunch', 'dinner']), insights: { [insightKey('day', DATE)]: stored } })

    await user.click(screen.getByRole('button', { name: /AI insights/ }))

    expect(await screen.findByText('Read this already.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    // Same day, so there is nothing to press for a second opinion.
    expect(screen.queryByRole('button', { name: 'Read it again' })).not.toBeInTheDocument()
    expect(screen.getByText(/come back tomorrow/)).toBeInTheDocument()
  })

  it('offers a fresh reading once the day has turned over', async () => {
    pinToday()
    vi.stubGlobal('fetch', vi.fn(async () => reply(ANSWER)))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    const stored: Insight = {
      scope: 'day',
      periodKey: DATE,
      generatedOn: '2026-10-06',
      headline: 'Yesterday I said this.',
      points: [],
      advice: [],
    }
    render({ ...logged(['breakfast', 'lunch', 'dinner']), insights: { [insightKey('day', DATE)]: stored } })

    await user.click(screen.getByRole('button', { name: /AI insights/ }))
    await user.click(await screen.findByRole('button', { name: 'Read it again' }))

    expect(await screen.findByText(/short on fibre/)).toBeInTheDocument()
  })

  it('says what went wrong rather than showing an empty panel', async () => {
    pinToday()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(logged(['breakfast', 'lunch', 'dinner']))

    await user.click(screen.getByRole('button', { name: /AI insights/ }))

    expect(await screen.findByText(/rejected that key/)).toBeInTheDocument()
  })

  it('keeps a day and a week of the same date apart', () => {
    const stored: Insight = {
      scope: 'week',
      periodKey: '2026-10-05',
      generatedOn: DATE,
      headline: 'Week reading.',
      points: [],
      advice: [],
    }
    render({
      ...logged(['breakfast', 'lunch', 'dinner']),
      insights: { [insightKey('week', '2026-10-05')]: stored },
    })

    // A week reading must not satisfy the day button.
    expect(screen.queryByText('Week reading.')).not.toBeInTheDocument()
  })
})
