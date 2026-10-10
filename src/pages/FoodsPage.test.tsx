import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import FoodsPage from './FoodsPage'
import { renderWithApp } from '../test/renderWithApp'
import type { Food } from '../domain/types'

const food = (name: string, category?: string, source: Food['source'] = 'seed'): Food => ({
  id: name,
  name,
  ...(category ? { category } : {}),
  per100g: { kcal: 100, fat: 1, satFat: 0.5, carbs: 10, fibre: 1, protein: 5, salt: 0.1 },
  source,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const foods = [
  food('Wholemeal bread', 'Bread, grains & cereals'),
  food('Porridge oats', 'Bread, grains & cereals'),
  food('Whole milk', 'Dairy & eggs'),
  food('Cheddar cheese', 'Dairy & eggs'),
  food('Banana', 'Fruit'),
  food('My own thing', undefined, 'user'),
]

const render = () =>
  renderWithApp(<FoodsPage />, { path: '/foods', route: '/foods', state: { foods } })

const rows = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
    .filter((text) => text !== 'New food')

describe('FoodsPage — category menu', () => {
  it('offers every category in view, plus All', () => {
    render()
    const filters = screen.getByRole('group', { name: 'Filter foods by category' })
    expect(filters).toHaveTextContent('All')
    expect(filters).toHaveTextContent('Bread, grains & cereals')
    expect(filters).toHaveTextContent('Dairy & eggs')
    // An uncategorised food is grouped under Other rather than dropped.
    expect(filters).toHaveTextContent('Other')
  })

  it('narrows the list to one category', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Dairy & eggs' }))
    expect(rows().join(' ')).toContain('Whole milk')
    expect(rows().join(' ')).toContain('Cheddar cheese')
    expect(rows().join(' ')).not.toContain('Banana')
  })

  it('drops the repeated heading once a category is chosen', async () => {
    const user = userEvent.setup()
    render()

    expect(screen.getByRole('heading', { name: 'Fruit' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fruit' }))
    // The chip already says it; the heading would just repeat it.
    expect(screen.queryByRole('heading', { name: 'Fruit' })).not.toBeInTheDocument()
  })

  it('goes back to everything via All', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Fruit' }))
    expect(rows()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(rows().length).toBeGreaterThan(1)
  })

  it('works together with the search rather than fighting it', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Bread, grains & cereals' }))
    await user.type(screen.getByRole('searchbox'), 'oats')
    expect(rows().join(' ')).toContain('Porridge oats')
    expect(rows().join(' ')).not.toContain('Wholemeal bread')
  })

  it('falls back to All when the search removes the chosen category', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Fruit' }))
    // Nothing in Fruit matches, so showing an empty list for an off-screen
    // reason would be the wrong answer.
    await user.type(screen.getByRole('searchbox'), 'milk')
    expect(rows().join(' ')).toContain('Whole milk')
  })

  it('hides the row when there is nothing to choose between', () => {
    renderWithApp(<FoodsPage />, {
      path: '/foods',
      route: '/foods',
      state: { foods: [food('Banana', 'Fruit')] },
    })
    expect(
      screen.queryByRole('group', { name: 'Filter foods by category' }),
    ).not.toBeInTheDocument()
  })
})

describe('FoodsPage — ordering', () => {
  it('lists your own foods before the bundled ones in each section', () => {
    const dairy = 'Dairy & eggs'
    renderWithApp(<FoodsPage />, {
      path: '/foods',
      route: '/foods',
      state: {
        foods: [
          food('Cheddar', dairy),
          food('Anna yoghurt', dairy, 'user'),
          food('Butter', dairy),
          food('Zoe kefir', dairy, 'user'),
        ],
      },
    })

    // Your two first, alphabetical, then the bundled two, alphabetical.
    // Rows carry their nutrition summary too, so compare on the name only.
    const names = rows().map((row) => row.split('100 kcal')[0])
    expect(names).toEqual(['Anna yoghurt', 'Zoe kefir', 'Butter', 'Cheddar'])
  })
})
