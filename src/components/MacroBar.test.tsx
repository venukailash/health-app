import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MacroBar from './MacroBar'
import type { Progress } from '../state/selectors'

const progress = (overrides: Partial<Progress> = {}): Progress => ({
  key: 'carbs',
  consumed: 130,
  target: 260,
  percent: 50,
  remaining: 130,
  over: false,
  ...overrides,
})

describe('MacroBar', () => {
  it('shows consumed, target and percentage', () => {
    render(<MacroBar label="Carbs" progress={progress()} color="red" />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText(/130 \/ 260 g/)).toBeInTheDocument()
  })

  it('exposes progress to assistive technology', () => {
    render(<MacroBar label="Carbs" progress={progress()} color="red" />)
    const bar = screen.getByRole('progressbar', { name: /Carbs: 50% of goal/ })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('reports the true percentage when over goal but caps the bar width', () => {
    render(
      <MacroBar
        label="Salt"
        progress={progress({ key: 'salt', consumed: 9, target: 6, percent: 150, remaining: -3, over: true })}
        color="red"
      />,
    )
    expect(screen.getByText('150%')).toBeInTheDocument()
    const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('renders an empty bar at zero', () => {
    render(
      <MacroBar label="Protein" progress={progress({ consumed: 0, percent: 0, remaining: 50 })} color="red" />,
    )
    const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('shows two decimals for small targets such as salt', () => {
    render(
      <MacroBar
        label="Salt"
        progress={progress({ key: 'salt', consumed: 0.25, target: 6, percent: 4, remaining: 5.75 })}
        color="red"
        unit="g"
      />,
    )
    expect(screen.getByText(/0\.25 \/ 6 g/)).toBeInTheDocument()
  })
})
