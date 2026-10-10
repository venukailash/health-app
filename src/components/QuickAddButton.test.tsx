import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import QuickAddButton from './QuickAddButton'

const at = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <QuickAddButton />
    </MemoryRouter>,
  )

describe('QuickAddButton', () => {
  it('goes straight to the camera, with describe one tap away', () => {
    at('/day/2026-10-10')
    expect(screen.getByRole('link', { name: 'Add a food from a photo' })).toHaveAttribute(
      'href',
      '/foods/new?ai=photo',
    )
  })

  it.each(['/day/2026-10-10', '/week/2026-10-10', '/month/2026-10-10', '/foods', '/recipes'])(
    'appears on the top-level screen %s',
    (route) => {
      at(route)
      expect(screen.getByRole('link', { name: 'Add a food from a photo' })).toBeInTheDocument()
    },
  )

  it.each([
    '/foods/new',
    '/foods/abc',
    '/recipes/new',
    '/settings/app',
    '/settings/targets',
    '/day/2026-10-10/add/breakfast',
    '/day/2026-10-10/entry/e1',
  ])('stays out of the way on %s', (route) => {
    // Deeper screens are mid-task; a button floating over the form is an
    // obstacle, not a shortcut.
    at(route)
    expect(screen.queryByRole('link', { name: 'Add a food from a photo' })).not.toBeInTheDocument()
  })
})
