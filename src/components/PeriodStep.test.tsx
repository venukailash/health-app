import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import PeriodStep from './PeriodStep'

const show = (props: { to: string; label: string; disabled?: boolean }) =>
  render(
    <MemoryRouter>
      <PeriodStep {...props} />
    </MemoryRouter>,
  )

describe('PeriodStep', () => {
  it('is a link when there is somewhere to go', () => {
    show({ to: '/day/2026-10-09', label: '← Yesterday' })
    expect(screen.getByRole('link', { name: '← Yesterday' })).toHaveAttribute(
      'href',
      '/day/2026-10-09',
    )
  })

  it('goes nowhere when the step would land in the future', () => {
    show({ to: '/day/2026-10-11', label: 'Tomorrow →', disabled: true })
    // Still on screen so the row does not jump about, but not a link.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Tomorrow →')).toHaveAttribute('aria-disabled', 'true')
  })
})
