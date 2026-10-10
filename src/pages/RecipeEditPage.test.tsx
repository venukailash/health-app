import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import RecipeEditPage from './RecipeEditPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood } from '../state/factories'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 9, protein: 11, salt: 0.02 },
  defaultServing: { label: '40 g serving', grams: 40 },
})

const renderNew = () =>
  renderWithApp(<RecipeEditPage />, {
    path: '/recipes/new',
    route: '/recipes/new',
    state: { foods: [oats] },
  })

describe('RecipeEditPage — ingredient picker', () => {
  it('offers a way back to the recipe from the picker', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('heading', { name: 'Add ingredient' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'New recipe' })).toBeInTheDocument()
  })

  it('keeps what was typed into the recipe while picking', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.type(screen.getByLabelText('Name'), 'Overnight oats')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Overnight oats')
  })

  it('clears the picker search so it does not reopen mid-query', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByRole('searchbox'), 'porridge')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('still adds an ingredient when one is chosen', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByText('Porridge oats'))

    const list = screen.getByRole('heading', { name: 'Ingredients' })
      .closest('section') as HTMLElement
    expect(within(list).getByText(/Porridge oats/)).toBeInTheDocument()
  })

  it('offers the same two options as foods, photo first', async () => {
    const user = userEvent.setup()
    renderNew()

    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    expect(buttons.indexOf('Photo')).toBeLessThan(buttons.indexOf('Describe'))

    await user.click(screen.getByRole('button', { name: 'Photo' }))
    expect(screen.getByRole('heading', { name: 'Let Gemini work it out' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Photo' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches between photo and description without leaving', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Photo' }))
    await user.click(screen.getByRole('tab', { name: 'Describe' }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('comes back to the recipe from the assist', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Describe' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'New recipe' })).toBeInTheDocument()
  })

  it('no longer buries a camera inside the ingredient picker', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(
      screen.queryByRole('button', { name: /Estimate an ingredient from a photo/ }),
    ).not.toBeInTheDocument()
    // Barcode scanning stays: a different capability, not a duplicate.
    expect(screen.getByRole('button', { name: 'Scan a barcode' })).toBeInTheDocument()
  })
})
