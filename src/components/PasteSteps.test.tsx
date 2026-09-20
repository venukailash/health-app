import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PasteSteps from './PasteSteps'

const setup = () => {
  const onImport = vi.fn()
  render(<PasteSteps onImport={onImport} />)
  return onImport
}

describe('PasteSteps', () => {
  it('imports counts pasted into the box', async () => {
    const user = userEvent.setup()
    const onImport = setup()

    await user.type(screen.getByLabelText('Or paste it here'), '2026-09-20:8421')
    await user.click(screen.getByRole('button', { name: /Import what is in the box/ }))

    expect(onImport).toHaveBeenCalledWith([{ date: '2026-09-20', steps: 8421 }])
  })

  it('accepts a whole URL, since pasting the link is the obvious thing to try', async () => {
    const user = userEvent.setup()
    const onImport = setup()

    await user.type(
      screen.getByLabelText('Or paste it here'),
      'https://example.com/health-app/#/activity/import?days=2026-09-20:8421',
    )
    await user.click(screen.getByRole('button', { name: /Import what is in the box/ }))

    expect(onImport).toHaveBeenCalledWith([{ date: '2026-09-20', steps: 8421 }])
  })

  it('reads the clipboard when asked', async () => {
    // userEvent installs its own clipboard stub, so spy on that rather than
    // replacing navigator.clipboard.
    const user = userEvent.setup()
    const onImport = setup()
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('2026-09-19:10233')

    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }))
    expect(onImport).toHaveBeenCalledWith([{ date: '2026-09-19', steps: 10233 }])
  })

  it('falls back to the box when the clipboard is refused', async () => {
    // Safari only allows a clipboard read from a gesture and can still refuse.
    const user = userEvent.setup()
    setup()
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(new Error('denied'))

    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }))
    expect(screen.getByText(/Paste into the box below instead/)).toBeInTheDocument()
  })

  it('says so when the text holds nothing readable', async () => {
    const user = userEvent.setup()
    const onImport = setup()

    await user.type(screen.getByLabelText('Or paste it here'), 'hello there')
    await user.click(screen.getByRole('button', { name: /Import what is in the box/ }))

    expect(onImport).not.toHaveBeenCalled()
    expect(screen.getByText(/Nothing in that could be read/)).toBeInTheDocument()
  })

  it('reports partially bad input rather than dropping it quietly', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(screen.getByLabelText('Or paste it here'), '2026-09-20:8421,nonsense')
    await user.click(screen.getByRole('button', { name: /Import what is in the box/ }))

    expect(screen.getByText(/Imported 1 day\. 1 skipped\./)).toBeInTheDocument()
  })
})
