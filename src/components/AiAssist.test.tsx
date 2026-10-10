import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AiAssist from './AiAssist'
import { AppStoreProvider } from '../state/AppStore'
import { ToastProvider } from '../state/ToastProvider'
import { EMPTY_STATE } from '../state/reducer'

const withCamera = (present: boolean) =>
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: vi
        .fn()
        .mockResolvedValue(present ? [{ kind: 'videoinput' }, { kind: 'audioinput' }] : [{ kind: 'audioinput' }]),
    },
  })

const renderAssist = (target: 'food' | 'recipe' = 'food') =>
  render(
    <ToastProvider>
      <AppStoreProvider initialState={{ ...EMPTY_STATE }}>
        <AiAssist target={target} onCancel={vi.fn()} />
      </AppStoreProvider>
    </ToastProvider>,
  )

beforeEach(() => vi.restoreAllMocks())
afterEach(() => {
  // @ts-expect-error - putting the override back
  delete navigator.mediaDevices
})

describe('AiAssist — choosing an image', () => {
  it('offers the camera first and the library second', async () => {
    withCamera(true)
    renderAssist()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument())

    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels.indexOf('Take a photo')).toBeLessThan(labels.indexOf('Choose a photo'))
  })

  it('opens the camera and the library through different inputs', async () => {
    withCamera(true)
    const { container } = renderAssist()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument())

    const inputs = [...container.querySelectorAll('input[type=file]')]
    expect(inputs).toHaveLength(2)
    // Only the camera one carries capture; one input cannot do both jobs.
    expect(inputs.filter((i) => i.hasAttribute('capture'))).toHaveLength(1)
    expect(inputs.every((i) => i.getAttribute('accept') === 'image/*')).toBe(true)
  })

  it('hides the camera button where there is no camera', async () => {
    withCamera(false)
    renderAssist()

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Take a photo' })).not.toBeInTheDocument(),
    )
    // The library option is still there, and is the primary one.
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeInTheDocument()
  })

  it('assumes a camera when the device list cannot be read', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    renderAssist()

    // Offering it and falling back to a file dialog beats hiding it from
    // someone who has one.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument(),
    )
  })

  it('still offers both options after a photo is chosen', async () => {
    withCamera(true)
    renderAssist()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeInTheDocument()
  })

  it('shows photo before describe, on both targets', async () => {
    withCamera(true)
    renderAssist('recipe')

    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Photo', 'Describe'])
  })

  it('switches to the description without leaving', async () => {
    withCamera(true)
    const user = userEvent.setup()
    renderAssist()

    await user.click(screen.getByRole('tab', { name: 'Describe' }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take a photo' })).not.toBeInTheDocument()
  })
})
