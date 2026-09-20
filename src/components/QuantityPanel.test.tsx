import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import QuantityPanel from './QuantityPanel'
import type { Food } from '../domain/types'
import { ZERO_NUTRIENTS } from '../domain/nutrition'

const eggs: Food = {
  id: 'f1',
  name: 'Free range British eggs',
  per100g: { ...ZERO_NUTRIENTS, kcal: 131, protein: 12.6, fat: 9.5 },
  defaultServing: { label: '1 egg', grams: 50 },
  source: 'user',
  createdAt: '2026-09-20T00:00:00.000Z',
}

const loose: Food = { ...eggs, id: 'f2', name: 'Loose rice', defaultServing: undefined }

const renderPanel = (food: Food, onConfirm = vi.fn(), initialQuantity = food.defaultServing?.grams ?? 100) => {
  render(
    <QuantityPanel
      target={{ kind: 'food', food }}
      initialQuantity={initialQuantity}
      confirmLabel="Add"
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  )
  return onConfirm
}

describe('QuantityPanel — foods with a portion', () => {
  it('starts in count mode, so typing 2 means two eggs', async () => {
    const user = userEvent.setup()
    const onConfirm = renderPanel(eggs)

    const input = screen.getByLabelText(/How many/)
    await user.clear(input)
    await user.type(input, '2')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Two eggs is 100 g, not 2 g.
    expect(onConfirm).toHaveBeenCalledWith(100, expect.objectContaining({ kcal: 131 }))
  })

  it('shows the gram weight a count works out to', async () => {
    const user = userEvent.setup()
    renderPanel(eggs)

    const input = screen.getByLabelText(/How many/)
    await user.clear(input)
    await user.type(input, '3')

    expect(screen.getByText(/This adds · 150 g/)).toBeInTheDocument()
  })

  it('offers both units', () => {
    renderPanel(eggs)
    expect(screen.getByRole('tab', { name: /Count/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Weight/ })).toBeInTheDocument()
  })

  it('switches to grams without changing how much food that is', async () => {
    const user = userEvent.setup()
    const onConfirm = renderPanel(eggs)

    const input = screen.getByLabelText(/How many/)
    await user.clear(input)
    await user.type(input, '2')
    await user.click(screen.getByRole('tab', { name: /Weight/ }))

    // Still two eggs' worth, now expressed as 100 g.
    expect(screen.getByLabelText('How much?')).toHaveValue(100)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onConfirm).toHaveBeenCalledWith(100, expect.anything())
  })

  it('switches back to counts without drift', async () => {
    const user = userEvent.setup()
    renderPanel(eggs)

    await user.click(screen.getByRole('tab', { name: /Weight/ }))
    const grams = screen.getByLabelText('How much?')
    await user.clear(grams)
    await user.type(grams, '150')
    await user.click(screen.getByRole('tab', { name: /Count/ }))

    expect(screen.getByLabelText(/How many/)).toHaveValue(3)
  })

  it('handles half a portion', async () => {
    const user = userEvent.setup()
    const onConfirm = renderPanel(eggs)

    await user.click(screen.getByRole('button', { name: '½' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onConfirm).toHaveBeenCalledWith(25, expect.anything())
  })

  it('offers counts rather than gram weights as shortcuts', () => {
    renderPanel(eggs)
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '100 g' })).not.toBeInTheDocument()
  })
})

describe('QuantityPanel — foods without a portion', () => {
  it('stays in grams and offers no unit switch', () => {
    renderPanel(loose)
    expect(screen.getByLabelText('How much?')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Count/ })).not.toBeInTheDocument()
  })

  it('logs the number typed as grams', async () => {
    const user = userEvent.setup()
    const onConfirm = renderPanel(loose)

    const input = screen.getByLabelText('How much?')
    await user.clear(input)
    await user.type(input, '75')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onConfirm).toHaveBeenCalledWith(75, expect.anything())
  })
})
