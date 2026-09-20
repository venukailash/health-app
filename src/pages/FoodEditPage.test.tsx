import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import FoodEditPage from './FoodEditPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood } from '../state/factories'
import { seedFoods } from '../storage/seed'

const userFood = createFood({
  name: 'My protein shake',
  per100g: { kcal: 380, fat: 6, satFat: 3, carbs: 8, fibre: 0, protein: 75, salt: 0.6 },
})

const renderNew = () =>
  renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new' })

describe('FoodEditPage — new food', () => {
  it('will not save without a name', async () => {
    const user = userEvent.setup()
    renderNew()

    const save = screen.getByRole('button', { name: 'Add food' })
    expect(save).toBeDisabled()

    await user.type(screen.getByLabelText('Name'), 'Oat milk')
    expect(save).toBeEnabled()
  })

  it('blocks saving when saturated fat exceeds total fat', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.type(screen.getByLabelText('Name'), 'Butter')
    await user.type(screen.getByLabelText('Fat'), '10')
    await user.type(screen.getByLabelText('of which saturates'), '30')

    expect(screen.getByText('Saturated fat cannot be higher than total fat.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add food' })).toBeDisabled()
  })

  it('shows the derived unsaturated fat as the user types', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.type(screen.getByLabelText('Fat'), '20')
    await user.type(screen.getByLabelText('of which saturates'), '5')

    expect(screen.getByText(/Unsaturated works out at 15\.0 g/)).toBeInTheDocument()
  })

  it('warns when the calories do not match the macros', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.type(screen.getByLabelText('Energy'), '1000')
    await user.type(screen.getByLabelText('Carbohydrate'), '10')

    expect(screen.getByText(/macros here add up to about 40 kcal/)).toBeInTheDocument()
  })

  it('previews the portion once a weight is entered', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.type(screen.getByLabelText('Energy'), '400')
    await user.type(screen.getByLabelText('Weight'), '50')

    expect(screen.getByText('200')).toBeInTheDocument()
  })
})

describe('FoodEditPage — existing food', () => {
  it('loads a user food for editing', () => {
    renderWithApp(<FoodEditPage />, {
      path: '/foods/:id',
      route: `/foods/${userFood.id}`,
      state: { foods: [userFood] },
    })

    expect(screen.getByLabelText('Name')).toHaveValue('My protein shake')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('locks a starter food and offers to duplicate it instead', () => {
    const seed = seedFoods[0]
    renderWithApp(<FoodEditPage />, {
      path: '/foods/:id',
      route: `/foods/${seed.id}`,
      state: { foods: [seed] },
    })

    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Duplicate to edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('explains that editing will not rewrite logged meals', () => {
    renderWithApp(<FoodEditPage />, {
      path: '/foods/:id',
      route: `/foods/${userFood.id}`,
      state: { foods: [userFood] },
    })

    expect(screen.getByText(/will not change your history/)).toBeInTheDocument()
  })

  it('reports a food that no longer exists', () => {
    renderWithApp(<FoodEditPage />, { path: '/foods/:id', route: '/foods/gone' })
    expect(screen.getByRole('heading', { name: 'Food not found' })).toBeInTheDocument()
  })
})
