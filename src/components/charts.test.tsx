import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import CalendarHeatmap, { stepFor } from './CalendarHeatmap'
import DailyColumns from './DailyColumns'
import type { DaySummary } from '../state/selectors'
import { ZERO_NUTRIENTS } from '../domain/nutrition'

const summary = (date: string, kcal: number | null): DaySummary => ({
  date,
  totals: kcal === null ? { ...ZERO_NUTRIENTS } : { ...ZERO_NUTRIENTS, kcal },
  logged: kcal !== null,
  entryCount: kcal === null ? 0 : 1,
})

const week: DaySummary[] = [
  summary('2026-09-14', 1800),
  summary('2026-09-15', 2400),
  summary('2026-09-16', null),
  summary('2026-09-17', 1950),
  summary('2026-09-18', null),
  summary('2026-09-19', 2100),
  summary('2026-09-20', 1500),
]

const renderIn = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('DailyColumns', () => {
  it('renders one link per day in the range', () => {
    renderIn(<DailyColumns days={week} goal={2000} caption="Calories per day" />)
    expect(screen.getAllByRole('link')).toHaveLength(7)
  })

  it('names each day and its calories for assistive technology', () => {
    renderIn(<DailyColumns days={week} goal={2000} caption="Calories per day" />)
    expect(
      screen.getByRole('link', { name: /2026-09-15: 2400 kilocalories/ }),
    ).toBeInTheDocument()
  })

  it('marks a blank day as nothing logged rather than zero calories', () => {
    renderIn(<DailyColumns days={week} goal={2000} caption="Calories per day" />)
    expect(screen.getByRole('link', { name: /2026-09-16: nothing logged/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /2026-09-16: 0 kilocalories/ })).not.toBeInTheDocument()
  })

  it('direct-labels only the peak day, not every column', () => {
    renderIn(<DailyColumns days={week} goal={2000} caption="Calories per day" />)
    expect(screen.getByText('2400')).toBeInTheDocument()
    // The other values stay in the tooltip and the day list.
    expect(screen.queryByText('1800')).not.toBeInTheDocument()
    expect(screen.queryByText('2100')).not.toBeInTheDocument()
  })

  it('shows the goal reference line when a goal is set', () => {
    renderIn(<DailyColumns days={week} goal={2000} caption="Calories per day" />)
    expect(screen.getByText('goal')).toBeInTheDocument()
  })

  it('omits the goal line when no goal is set', () => {
    renderIn(<DailyColumns days={week} goal={0} caption="Calories per day" />)
    expect(screen.queryByText('goal')).not.toBeInTheDocument()
  })

  it('renders its caption', () => {
    renderIn(<DailyColumns days={week} goal={2000} caption="Calories per day" />)
    expect(screen.getByText('Calories per day')).toBeInTheDocument()
  })

  it('copes with a week where nothing was logged', () => {
    const blank = week.map((day) => summary(day.date, null))
    renderIn(<DailyColumns days={blank} goal={2000} caption="Calories per day" />)
    expect(screen.getAllByRole('link')).toHaveLength(7)
    expect(screen.getAllByRole('link', { name: /nothing logged/ })).toHaveLength(7)
  })
})

describe('stepFor', () => {
  it('maps a percentage onto the sequential ramp, light to dark', () => {
    expect(stepFor(10).token).toBe('var(--heat-1)')
    expect(stepFor(60).token).toBe('var(--heat-2)')
    expect(stepFor(90).token).toBe('var(--heat-3)')
    expect(stepFor(105).token).toBe('var(--heat-4)')
  })

  it('spreads typical days across the ramp rather than bunching them at the top', () => {
    // Real days cluster between half and a little over goal, so those must
    // not all land in the same shade.
    const shades = new Set([45, 65, 85, 110].map((percent) => stepFor(percent).token))
    expect(shades.size).toBe(4)
  })

  it('keeps the darkest step for anything over goal', () => {
    expect(stepFor(150).token).toBe('var(--heat-4)')
    expect(stepFor(1000).token).toBe('var(--heat-4)')
  })

  it('puts the boundaries in the lower step', () => {
    expect(stepFor(50).token).toBe('var(--heat-1)')
    expect(stepFor(75).token).toBe('var(--heat-2)')
    expect(stepFor(100).token).toBe('var(--heat-3)')
  })
})

describe('CalendarHeatmap', () => {
  const summaries = new Map<string, DaySummary>([
    ['2026-09-01', summary('2026-09-01', 1800)],
    ['2026-09-02', summary('2026-09-02', 2600)], // over a 2000 goal
    ['2026-09-20', summary('2026-09-20', 900)],
  ])

  const renderMonth = () =>
    renderIn(
      <CalendarHeatmap
        month="2026-09-01"
        summaries={summaries}
        goal={2000}
        today="2026-09-20"
      />,
    )

  it('renders a link for every day of the month and no others', () => {
    renderMonth()
    // September 2026 has 30 days; padding days are not links.
    expect(screen.getAllByRole('link')).toHaveLength(30)
  })

  it('carries the numbers in each cell name, so nothing is colour-only', () => {
    renderMonth()
    expect(
      screen.getByRole('link', { name: '2026-09-01: 1800 kilocalories, 90% of goal' }),
    ).toBeInTheDocument()
  })

  it('flags an over-goal day in its accessible name as well as visually', () => {
    renderMonth()
    expect(
      screen.getByRole('link', { name: /2026-09-02: 2600 kilocalories, 130% of goal, over goal/ }),
    ).toBeInTheDocument()
  })

  it('marks unlogged days as such', () => {
    renderMonth()
    expect(screen.getByRole('link', { name: '2026-09-15: nothing logged' })).toBeInTheDocument()
  })

  it('links each day to its own page', () => {
    renderMonth()
    expect(screen.getByRole('link', { name: /2026-09-20/ })).toHaveAttribute(
      'href',
      '/day/2026-09-20',
    )
  })

  it('explains the ramp, the empty state and the over-goal marker in a legend', () => {
    renderMonth()
    const legend = screen.getByRole('figure')
    expect(within(legend).getByText(/Less/)).toBeInTheDocument()
    expect(within(legend).getByText(/More of goal/)).toBeInTheDocument()
    expect(within(legend).getByText('Not logged')).toBeInTheDocument()
    expect(within(legend).getByText('Over goal')).toBeInTheDocument()
  })

  it('shows a weekday header row starting on Monday', () => {
    renderMonth()
    const monday = new Date(2026, 0, 5).toLocaleDateString(undefined, { weekday: 'narrow' })
    expect(screen.getAllByText(monday).length).toBeGreaterThan(0)
  })
})
