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

describe('FoodEditPage — Gemini assist', () => {
  it('starts on the camera when the floating button asks for it', () => {
    renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new?ai=photo' })
    expect(screen.getByRole('tab', { name: 'Photo' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument()
  })

  it('can start on the description instead', () => {
    renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new?ai=describe' })
    expect(screen.getByRole('tab', { name: 'Describe' })).toHaveAttribute('aria-selected', 'true')
  })

  it('ignores an unknown mode and shows the form', () => {
    renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new?ai=nonsense' })
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('offers both options, photo first', async () => {
    const user = userEvent.setup()
    renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new' })

    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    expect(buttons.indexOf('Photo')).toBeLessThan(buttons.indexOf('Describe'))

    await user.click(screen.getByRole('button', { name: 'Describe' }))
    expect(screen.getByRole('tab', { name: 'Describe' })).toHaveAttribute('aria-selected', 'true')
  })

  it('comes back to the form', async () => {
    const user = userEvent.setup()
    renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new?ai=photo' })

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('starts on the form otherwise', () => {
    renderWithApp(<FoodEditPage />, { path: '/foods/new', route: '/foods/new' })
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })
})

describe('AppSettings — API keys', () => {
  it('masks both keys, since both are credentials', async () => {
    const { default: AppSettingsPage } = await import('./AppSettingsPage')
    renderWithApp(<AppSettingsPage />, { path: '/settings/app', route: '/settings/app' })

    expect(screen.getByLabelText(/FoodData Central API key/)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/Gemini API key/)).toHaveAttribute('type', 'password')
    // The model name is not a secret and stays readable.
    expect(screen.getByLabelText(/^Model/)).toHaveAttribute('type', 'text')
  })
})
