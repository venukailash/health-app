import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as gemini from '../services/gemini'
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
})

const jpeg = () => new File(['x'], 'food.jpg', { type: 'image/jpeg' })

/** Put a file into the hidden input the buttons drive. */
async function pickPhoto(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  const input = container.querySelector('input[type=file]:not([capture])') as HTMLInputElement
  await user.upload(input, jpeg())
}

describe('AiAssist — adding context to a photo', () => {
  beforeEach(() => {
    withCamera(true)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:x' })
  })

  it('does not send the photo the moment it is chosen', async () => {
    const estimate = vi.spyOn(gemini, 'estimateFood').mockResolvedValue({
      name: 'X',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      confidence: 'low',
    })
    const user = userEvent.setup()
    const { container } = renderAssist()

    await pickPhoto(user, container)

    // The whole point: there is a chance to add context first.
    expect(estimate).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Anything else that would help/)).toBeInTheDocument()
  })

  it('sends the photo together with the note', async () => {
    const estimate = vi.spyOn(gemini, 'estimateFood').mockResolvedValue({
      name: 'X',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      confidence: 'low',
    })
    const user = userEvent.setup()
    const { container } = renderAssist()

    await pickPhoto(user, container)
    await user.type(screen.getByLabelText(/Anything else that would help/), 'fried in olive oil')
    await user.click(screen.getByRole('button', { name: 'Work it out' }))

    await waitFor(() => expect(estimate).toHaveBeenCalled())
    expect(estimate.mock.calls[0][0]).toMatchObject({ text: 'fried in olive oil' })
    expect(estimate.mock.calls[0][0].photos?.[0]).toBeInstanceOf(File)
  })

  it('sends the photo alone when no note is written', async () => {
    const estimate = vi.spyOn(gemini, 'estimateFood').mockResolvedValue({
      name: 'X',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      confidence: 'low',
    })
    const user = userEvent.setup()
    const { container } = renderAssist()

    await pickPhoto(user, container)
    await user.click(screen.getByRole('button', { name: 'Work it out' }))

    await waitFor(() => expect(estimate).toHaveBeenCalled())
    expect(estimate.mock.calls[0][0].photos?.[0]).toBeInstanceOf(File)
  })

  it('lets a disappointing answer be retried with more context', async () => {
    const estimate = vi.spyOn(gemini, 'estimateFood').mockResolvedValue({
      name: 'Vague guess',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      confidence: 'low',
    })
    const user = userEvent.setup()
    const { container } = renderAssist()

    await pickPhoto(user, container)
    await user.click(screen.getByRole('button', { name: 'Work it out' }))
    await screen.findByText('Vague guess')

    // The note stays available, and the button says what it will do.
    await user.type(screen.getByLabelText(/Anything else that would help/), 'half a portion')
    await user.click(screen.getByRole('button', { name: 'Work it out again' }))

    await waitFor(() => expect(estimate).toHaveBeenCalledTimes(2))
    expect(estimate.mock.calls[1][0]).toMatchObject({ text: 'half a portion' })
  })

  it('offers no note box until a photo is chosen', async () => {
    renderAssist()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument(),
    )
    expect(screen.queryByLabelText(/Anything else that would help/)).not.toBeInTheDocument()
  })

  it('keeps Describe as its own option, with no photo attached', async () => {
    const estimate = vi.spyOn(gemini, 'estimateFood').mockResolvedValue({
      name: 'X',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      confidence: 'low',
    })
    const user = userEvent.setup()
    renderAssist()

    await user.click(screen.getByRole('tab', { name: 'Describe' }))
    await user.type(screen.getByRole('textbox'), 'a flat white')
    await user.click(screen.getByRole('button', { name: 'Work it out' }))

    await waitFor(() => expect(estimate).toHaveBeenCalled())
    expect(estimate.mock.calls[0][0].photos?.length ?? 0).toBe(0)
    expect(estimate.mock.calls[0][0]).toMatchObject({ text: 'a flat white' })
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

describe('AiAssist — several photos', () => {
  beforeEach(() => {
    withCamera(true)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => `blob:${Math.random()}`,
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
  })

  const stub = () =>
    vi.spyOn(gemini, 'estimateFood').mockResolvedValue({
      name: 'X',
      per100g: { kcal: 1, fat: 0, satFat: 0, carbs: 0, fibre: 0, protein: 0, salt: 0 },
      confidence: 'low',
    })

  it('sends every photo added', async () => {
    const estimate = stub()
    const user = userEvent.setup()
    const { container } = renderAssist()
    const input = container.querySelector('input[type=file][multiple]') as HTMLInputElement

    await user.upload(input, [jpeg(), jpeg()])
    await user.click(screen.getByRole('button', { name: 'Work it out' }))

    await waitFor(() => expect(estimate).toHaveBeenCalled())
    // A second shot of the container is often what makes the portion judgeable.
    expect(estimate.mock.calls[0][0].photos).toHaveLength(2)
  })

  it('shows a thumbnail per photo and lets one be removed', async () => {
    stub()
    const user = userEvent.setup()
    const { container } = renderAssist()
    const input = container.querySelector('input[type=file][multiple]') as HTMLInputElement

    await user.upload(input, [jpeg(), jpeg()])
    expect(screen.getAllByRole('img')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('invites another shot once there is one', async () => {
    stub()
    const user = userEvent.setup()
    const { container } = renderAssist()
    const input = container.querySelector('input[type=file][multiple]') as HTMLInputElement

    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument()
    await user.upload(input, [jpeg()])
    expect(screen.getByRole('button', { name: 'Add another photo' })).toBeInTheDocument()
  })

  it('stops at the cap rather than letting cost climb for nothing', async () => {
    stub()
    const user = userEvent.setup()
    const { container } = renderAssist()
    const input = container.querySelector('input[type=file][multiple]') as HTMLInputElement

    await user.upload(input, [jpeg(), jpeg(), jpeg(), jpeg(), jpeg(), jpeg()])

    expect(screen.getAllByRole('img')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Add another photo' })).not.toBeInTheDocument()
    expect(screen.getByText(/4 photos is the most that helps/)).toBeInTheDocument()
  })
})
