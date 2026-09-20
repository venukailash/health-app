import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SearchList, { filterItems, type SearchItem } from './SearchList'

const items: SearchItem[] = [
  { id: '1', name: 'Porridge oats', detail: '379 kcal per 100 g', keywords: 'Grains' },
  { id: '2', name: 'Chicken breast', detail: '165 kcal per 100 g', keywords: 'Meat' },
  { id: '3', name: 'Cheddar cheese', detail: '416 kcal per 100 g', keywords: 'Dairy' },
]

describe('filterItems', () => {
  it('returns everything for an empty query', () => {
    expect(filterItems(items, '   ')).toHaveLength(3)
  })

  it('matches on name, case-insensitively', () => {
    expect(filterItems(items, 'CHICK').map((item) => item.id)).toEqual(['2'])
  })

  it('matches on hidden keywords such as category', () => {
    expect(filterItems(items, 'dairy').map((item) => item.id)).toEqual(['3'])
  })

  it('returns nothing when there is no match', () => {
    expect(filterItems(items, 'kumquat')).toEqual([])
  })
})

describe('SearchList', () => {
  it('filters the rendered list as the user types', async () => {
    const user = userEvent.setup()
    render(<SearchList items={items} onSelect={vi.fn()} />)

    expect(screen.getAllByRole('button')).toHaveLength(3)
    await user.type(screen.getByRole('searchbox'), 'oats')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Porridge oats')).toBeInTheDocument()
  })

  it('reports the id of the chosen item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SearchList items={items} onSelect={onSelect} />)

    await user.click(screen.getByText('Cheddar cheese'))
    expect(onSelect).toHaveBeenCalledWith('3')
  })

  it('shows the empty message when nothing matches', async () => {
    const user = userEvent.setup()
    render(<SearchList items={items} onSelect={vi.fn()} emptyMessage="No foods here" />)

    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('No foods here')).toBeInTheDocument()
  })

  it('caps how many rows it renders and says how many are hidden', () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      id: String(index),
      name: `Food ${index}`,
    }))
    render(<SearchList items={many} onSelect={vi.fn()} limit={10} />)

    expect(screen.getAllByRole('button')).toHaveLength(10)
    expect(screen.getByText(/Showing 10 of 80/)).toBeInTheDocument()
  })
})
