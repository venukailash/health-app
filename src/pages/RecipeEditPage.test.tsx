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

  it('offers a way back from the photo estimator too', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Estimate an ingredient from a photo' }))
    expect(screen.getByRole('heading', { name: 'From a photo' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Add ingredient' })).toBeInTheDocument()
  })
})
