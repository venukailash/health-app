import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShortcutImport from './ShortcutImport'

const AWAITING_KEY = 'healthapp.awaitingShortcut'

// A default parameter would swallow an explicit `undefined`, which is exactly
// the case one test needs.
const setup = (...args: [] | [string | undefined]) => {
  const shortcutName = args.length === 0 ? 'My Steps' : args[0]
  const onImport = vi.fn()
  const onMessage = vi.fn()
  render(
    <ShortcutImport shortcutName={shortcutName} onImport={onImport} onMessage={onMessage} />,
  )
  return { onImport, onMessage }
}

/** Pretend the app has just come back from Shortcuts. */
const returnToApp = () => document.dispatchEvent(new Event('visibilitychange'))

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  // jsdom has no clipboard at all; give it one to spy on.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText: async () => '', writeText: async () => undefined },
  })
})
afterEach(() => vi.useRealTimers())

describe('ShortcutImport', () => {
  it('shows nothing until a shortcut name is configured', () => {
    setup(undefined)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers a single button that names the shortcut', () => {
    setup()
    expect(screen.getByRole('button', { name: /Run “My Steps” and import/ })).toBeInTheDocument()
  })

  it('launches the shortcut and records that an import is expected', async () => {
    const user = userEvent.setup()
    setup()

    // jsdom refuses to navigate, so watch the assignment instead.
    const assigned: string[] = []
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return ''
        },
        set href(value: string) {
          assigned.push(value)
        },
      },
    })

    await user.click(screen.getByRole('button', { name: /Run/ }))

    expect(assigned[0]).toBe('shortcuts://run-shortcut?name=My%20Steps')
    // The flag has to outlive the page: iOS discards a backgrounded web app.
    expect(localStorage.getItem(AWAITING_KEY)).not.toBeNull()
  })

  it('imports by itself on return when the clipboard can be read', async () => {
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('2026-09-20:8421')
    localStorage.setItem(AWAITING_KEY, String(Date.now()))

    const { onImport } = setup()
    returnToApp()

    await waitFor(
      () => expect(onImport).toHaveBeenCalledWith([{ date: '2026-09-20', steps: 8421 }]),
      { timeout: 3000 },
    )
  })

  it('asks for one tap when the browser refuses to read the clipboard', async () => {
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(new Error('NotAllowedError'))
    localStorage.setItem(AWAITING_KEY, String(Date.now()))

    setup()
    returnToApp()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Import the steps' })).toBeInTheDocument(), {
      timeout: 3000,
    })
  })

  it('imports from that tap, which does count as a gesture', async () => {
    const user = userEvent.setup()
    const readText = vi
      .spyOn(navigator.clipboard, 'readText')
      .mockRejectedValueOnce(new Error('NotAllowedError'))
    localStorage.setItem(AWAITING_KEY, String(Date.now()))

    const { onImport } = setup()
    returnToApp()

    const button = await screen.findByRole('button', { name: 'Import the steps' }, { timeout: 3000 })
    readText.mockResolvedValue('2026-09-19:10233')
    await user.click(button)

    await waitFor(() => expect(onImport).toHaveBeenCalledWith([{ date: '2026-09-19', steps: 10233 }]))
  })

  it('ignores a run that was abandoned long ago', async () => {
    const readText = vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('2026-09-20:8421')
    // Older than the five-minute window.
    localStorage.setItem(AWAITING_KEY, String(Date.now() - 10 * 60 * 1000))

    const { onImport } = setup()
    returnToApp()

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(readText).not.toHaveBeenCalled()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('does not read the clipboard when no run is outstanding', async () => {
    const readText = vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('2026-09-20:8421')

    setup()
    returnToApp()

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(readText).not.toHaveBeenCalled()
  })

  it('reports a clipboard that holds nothing usable', async () => {
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('some unrelated text')
    localStorage.setItem(AWAITING_KEY, String(Date.now()))

    const { onMessage, onImport } = setup()
    returnToApp()

    await waitFor(
      () => expect(onMessage).toHaveBeenCalledWith(expect.stringMatching(/did not hold any step counts/), 'error'),
      { timeout: 3000 },
    )
    expect(onImport).not.toHaveBeenCalled()
  })

  it('accepts a full URL left on the clipboard', async () => {
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue(
      'https://example.com/#/activity/import?days=2026-09-18:4102',
    )
    localStorage.setItem(AWAITING_KEY, String(Date.now()))

    const { onImport } = setup()
    returnToApp()

    await waitFor(() => expect(onImport).toHaveBeenCalledWith([{ date: '2026-09-18', steps: 4102 }]), {
      timeout: 3000,
    })
  })
})
