import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import RecipesPage from './RecipesPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, createRecipe } from '../state/factories'
import type { Recipe } from '../domain/types'

const oats = createFood({
  name: 'Porridge oats',
  per100g: { kcal: 379, fat: 8, satFat: 1.4, carbs: 60, fibre: 9, protein: 11, salt: 0.02 },
})

const recipe = (name: string, meals?: Recipe['meals']): Recipe => ({
  ...createRecipe({ name, servings: 1, ingredients: [{ foodId: oats.id, grams: 100 }] }),
  id: name,
  ...(meals ? { meals } : {}),
})

const recipes = [
  recipe('Overnight oats', ['breakfast']),
  recipe('Chicken traybake', ['lunch', 'dinner']),
  recipe('Protein balls', ['snack']),
  // Made before tagging existed: untagged, and must stay that way.
  recipe('Old favourite'),
]

const render = () =>
  renderWithApp(<RecipesPage />, {
    path: '/recipes',
    route: '/recipes',
    state: { foods: [oats], recipes },
  })

const names = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
    .filter((text) => text !== 'New recipe')

describe('RecipesPage — meal filter', () => {
  it('shows every recipe by default, tagged or not', () => {
    render()
    expect(names().join(' ')).toContain('Old favourite')
    expect(names()).toHaveLength(4)
  })

  it('filters to one meal', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Breakfast' }))
    expect(names().join(' ')).toContain('Overnight oats')
    expect(names().join(' ')).not.toContain('Chicken traybake')
  })

  it('keeps a recipe tagged with several meals under each of them', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Lunch' }))
    expect(names().join(' ')).toContain('Chicken traybake')

    await user.click(screen.getByRole('button', { name: 'Dinner' }))
    expect(names().join(' ')).toContain('Chicken traybake')
  })

  it('leaves untagged recipes out of a filtered view', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Breakfast' }))
    expect(names().join(' ')).not.toContain('Old favourite')
  })

  it('goes back to everything via All', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Snacks' }))
    expect(names()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(names()).toHaveLength(4)
  })

  it('says how many are showing when filtered', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Breakfast' }))
    expect(screen.getByText('1 of 4 recipes')).toBeInTheDocument()
  })

  it('explains an empty filter rather than looking broken', async () => {
    const user = userEvent.setup()
    renderWithApp(<RecipesPage />, {
      path: '/recipes',
      route: '/recipes',
      state: { foods: [oats], recipes: [recipe('Old favourite')] },
    })

    await user.click(screen.getByRole('button', { name: 'Dinner' }))
    expect(screen.getByText(/No recipes tagged dinner/)).toBeInTheDocument()
    // And makes clear a tag is not a restriction.
    expect(screen.getByText(/can still be logged to any meal/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show all recipes' }))
    expect(names().join(' ')).toContain('Old favourite')
  })

  it('shows the tags on each recipe', () => {
    render()
    const row = screen.getByRole('link', { name: /Chicken traybake/ })
    expect(within(row).getByText('Lunch')).toBeInTheDocument()
    expect(within(row).getByText('Dinner')).toBeInTheDocument()
  })

  it('offers no filter at all when there are no recipes', () => {
    renderWithApp(<RecipesPage />, {
      path: '/recipes',
      route: '/recipes',
      state: { foods: [oats], recipes: [] },
    })
    expect(screen.queryByRole('button', { name: 'Breakfast' })).not.toBeInTheDocument()
    expect(screen.getByText('No recipes yet')).toBeInTheDocument()
  })
})
