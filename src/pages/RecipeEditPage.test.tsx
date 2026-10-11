import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import RecipeEditPage from './RecipeEditPage'
import { renderWithApp } from '../test/renderWithApp'
import { createFood, createRecipe } from '../state/factories'
import { AppStoreProvider } from '../state/AppStore'
import { ToastProvider } from '../state/ToastProvider'
import { EMPTY_STATE } from '../state/reducer'

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

describe('RecipeEditPage — meal tags', () => {
  it('starts untagged and stays that way unless chosen', async () => {
    const user = userEvent.setup()
    renderNew()

    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      expect(screen.getByRole('button', { name: meal })).toHaveAttribute('aria-pressed', 'false')
    }
    await user.click(screen.getByRole('button', { name: 'Breakfast' }))
    expect(screen.getByRole('button', { name: 'Breakfast' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('allows several meals at once', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Lunch' }))
    await user.click(screen.getByRole('button', { name: 'Dinner' }))

    expect(screen.getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles a tag back off', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', { name: 'Snacks' }))
    await user.click(screen.getByRole('button', { name: 'Snacks' }))
    expect(screen.getByRole('button', { name: 'Snacks' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('says plainly that a tag is not a restriction', () => {
    renderNew()
    expect(screen.getByText(/never stops you logging this to any meal/)).toBeInTheDocument()
  })
})

describe('RecipeEditPage — duplicating', () => {
  const rice = createFood({
    name: 'Basmati rice',
    per100g: { kcal: 130, fat: 0.3, satFat: 0.1, carbs: 28, fibre: 0.4, protein: 2.7, salt: 0 },
  })

  const dhal = createRecipe({
    name: 'Dhal',
    servings: 4,
    meals: ['dinner'],
    ingredients: [
      { foodId: oats.id, grams: 200 },
      { foodId: rice.id, grams: 300 },
    ],
  })

  const renderCopy = (recipes = [dhal]) =>
    renderWithApp(<RecipeEditPage />, {
      path: '/recipes/new',
      route: `/recipes/new?from=${dhal.id}`,
      state: { foods: [oats, rice], recipes },
    })

  it('opens a copy with the ingredients already in it', () => {
    renderCopy()

    expect(screen.getByRole('heading', { name: 'Copy of Dhal' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Dhal (copy)')
    expect(screen.getByLabelText('Makes')).toHaveValue(4)
    expect(screen.getByText('Porridge oats')).toBeInTheDocument()
    expect(screen.getByText('Basmati rice')).toBeInTheDocument()
  })

  it('numbers the copy when an earlier one is already saved', () => {
    renderCopy([dhal, createRecipe({ name: 'Dhal (copy)', servings: 1, ingredients: [] })])
    expect(screen.getByLabelText('Name')).toHaveValue('Dhal (copy 2)')
  })

  it('saves as a new recipe and leaves the original alone', async () => {
    const user = userEvent.setup()
    const { store } = renderCopy()

    // Take one ingredient out — the point of a copy.
    await user.click(screen.getByRole('button', { name: 'Remove Basmati rice' }))
    await user.click(screen.getByRole('button', { name: 'Save copy' }))

    const saved = store().recipes
    expect(saved).toHaveLength(2)

    const original = saved.find((recipe) => recipe.id === dhal.id)
    expect(original?.name).toBe('Dhal')
    expect(original?.ingredients).toHaveLength(2)

    const copy = saved.find((recipe) => recipe.id !== dhal.id)
    expect(copy?.name).toBe('Dhal (copy)')
    expect(copy?.ingredients).toEqual([{ foodId: oats.id, grams: 200 }])
    expect(copy?.meals).toEqual(['dinner'])
  })

  it('opens a blank recipe when the source has since been deleted', () => {
    renderWithApp(<RecipeEditPage />, {
      path: '/recipes/new',
      route: '/recipes/new?from=gone',
      state: { foods: [oats], recipes: [dhal] },
    })

    expect(screen.getByRole('heading', { name: 'New recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('offers Duplicate from a saved recipe', () => {
    renderWithApp(<RecipeEditPage />, {
      path: '/recipes/:id',
      route: `/recipes/${dhal.id}`,
      state: { foods: [oats, rice], recipes: [dhal] },
    })

    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
  })
})

describe('RecipeEditPage — going straight from a recipe to its copy', () => {
  const dhal = createRecipe({
    name: 'Dhal',
    servings: 4,
    ingredients: [{ foodId: oats.id, grams: 200 }],
  })

  /**
   * Both routes mounted together, which is what the app does. React Router
   * renders the same component for each, so without a remount the editor
   * carries the previous recipe's state across — the bug this covers.
   */
  function renderBothRoutes() {
    return render(
      <ToastProvider>
        <AppStoreProvider initialState={{ ...EMPTY_STATE, foods: [oats], recipes: [dhal] }}>
          <MemoryRouter initialEntries={[`/recipes/${dhal.id}`]}>
            <Routes>
              <Route path="/recipes/new" element={<RecipeEditPage />} />
              <Route path="/recipes/:id" element={<RecipeEditPage />} />
            </Routes>
          </MemoryRouter>
        </AppStoreProvider>
      </ToastProvider>,
    )
  }

  it('starts the copy from the original, not from whatever was on screen', async () => {
    const user = userEvent.setup()
    renderBothRoutes()

    expect(screen.getByLabelText('Name')).toHaveValue('Dhal')

    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(screen.getByRole('heading', { name: 'Copy of Dhal' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Dhal (copy)')
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeInTheDocument()
  })
})

describe('RecipeEditPage — adding it to a meal', () => {
  const dhal = createRecipe({
    name: 'Dhal',
    servings: 2,
    ingredients: [{ foodId: oats.id, grams: 200 }],
  })

  const renderSaved = () =>
    renderWithApp(<RecipeEditPage />, {
      path: '/recipes/:id',
      route: `/recipes/${dhal.id}`,
      state: { foods: [oats], recipes: [dhal] },
    })

  const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Add to a meal' }))
    return screen.getByRole('dialog')
  }

  it('keeps the four meals behind one button', async () => {
    const user = userEvent.setup()
    renderSaved()

    // Nothing on the page until asked for — the meal TAGS above are a
    // different control and stay where they are.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const sheet = await openSheet(user)
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      expect(within(sheet).getByRole('button', { name: meal })).toBeInTheDocument()
    }
  })

  it('logs one serving to the meal that was tapped, today', async () => {
    const user = userEvent.setup()
    const { store } = renderSaved()

    const sheet = await openSheet(user)
    await user.click(within(sheet).getByRole('button', { name: 'Lunch' }))

    const days = Object.values(store().log)
    expect(days).toHaveLength(1)
    const [entry] = days[0]
    expect(entry.meal).toBe('lunch')
    expect(entry.label).toBe('Dhal')
    expect(entry.ref).toEqual({ kind: 'recipe', id: dhal.id, servings: 1 })
    // Half the recipe's 200 g of oats, per serving.
    expect(Math.round(entry.nutrients.kcal)).toBe(379)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('backs out without logging anything', async () => {
    const user = userEvent.setup()
    const { store } = renderSaved()

    const sheet = await openSheet(user)
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(store().log).toEqual({})
  })

  it('does not offer it for a recipe that has never been saved', () => {
    renderWithApp(<RecipeEditPage />, {
      path: '/recipes/new',
      route: '/recipes/new',
      state: { foods: [oats] },
    })
    expect(screen.queryByRole('button', { name: 'Add to a meal' })).not.toBeInTheDocument()
  })

  it('logs what is saved, not what is being typed', async () => {
    const user = userEvent.setup()
    const { store } = renderSaved()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Renamed but not saved')
    const sheet = await openSheet(user)
    await user.click(within(sheet).getByRole('button', { name: 'Dinner' }))

    expect(Object.values(store().log)[0][0].label).toBe('Dhal')
  })
})
