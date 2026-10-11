import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BarcodeScanner from './BarcodeScanner'

/**
 * jsdom has no camera and no decoder, so both are stood up by hand: a fake
 * `getUserMedia` whose tracks record being stopped, and a fake
 * `BarcodeDetector` the test drives frame by frame.
 */
let stopped: number
let detectNext: string | null

function stubCamera({ allow = true } = {}) {
  stopped = 0
  const track = { stop: () => (stopped += 1) }
  const stream = { getTracks: () => [track] } as unknown as MediaStream

  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: {
      getUserMedia: allow
        ? vi.fn(async () => stream)
        : vi.fn(async () => {
            throw new DOMException('no', 'NotAllowedError')
          }),
    },
  })
}

function stubDetector() {
  detectNext = null
  class FakeDetector {
    async detect() {
      return detectNext ? [{ rawValue: detectNext }] : []
    }
  }
  vi.stubGlobal('BarcodeDetector', FakeDetector)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  stubCamera()
  stubDetector()
  // jsdom cannot play video.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn(async () => undefined),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const show = (onDetected: (code: string) => Promise<boolean>) =>
  render(<BarcodeScanner onDetected={onDetected} onCancel={() => {}} />)

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    vi.advanceTimersByTime(50)
  })
}

describe('BarcodeScanner', () => {
  it('says what it is doing while the camera warms up and scans', async () => {
    show(async () => true)
    expect(screen.getByRole('status')).toHaveTextContent('Starting the camera')

    await flush()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Point the camera'))
  })

  it('shows the code it read while the lookup is in flight', async () => {
    let release: (used: boolean) => void = () => {}
    show(() => new Promise<boolean>((resolve) => (release = resolve)))

    await flush()
    detectNext = '5012345678900'
    await flush()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Read 5012345678900 — looking it up'),
    )

    await act(async () => release(true))
  })

  it('stays open and goes back to scanning when the code leads nowhere', async () => {
    show(async () => false)

    await flush()
    detectNext = '0000000000000'
    await flush()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Nothing came back for 0000000000000'),
    )
    // Camera is still running: nothing was stopped.
    expect(stopped).toBe(0)

    await act(async () => {
      vi.advanceTimersByTime(2600)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Point the camera')
  })

  it('does not keep querying a code it has already been refused', async () => {
    const onDetected = vi.fn(async () => false)
    show(onDetected)

    await flush()
    // The packet stays in frame, as it does in real life.
    detectNext = '0000000000000'
    await flush()
    await act(async () => {
      vi.advanceTimersByTime(2600)
    })
    await flush()
    await flush()

    expect(onDetected).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Point the camera')
  })

  it('does not look the same code up twice while one is in flight', async () => {
    const onDetected = vi.fn(async () => false)
    show(onDetected)

    await flush()
    detectNext = '5012345678900'
    await flush()
    await flush()
    await flush()

    expect(onDetected).toHaveBeenCalledTimes(1)
  })

  it('turns the camera off when you start typing, and back on if you change your mind', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    show(async () => true)
    await flush()

    await user.click(screen.getByLabelText('Barcode number'))
    await waitFor(() => expect(stopped).toBe(1))
    expect(screen.getByRole('status')).toHaveTextContent('Camera off')
    expect(screen.queryByLabelText('Camera preview')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use the camera' }))
    await flush()
    expect(screen.getByLabelText('Camera preview')).toBeInTheDocument()
  })

  it('admits when it has been looking for a while', async () => {
    show(async () => true)
    await flush()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Point the camera'))

    await act(async () => {
      vi.advanceTimersByTime(8500)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Still looking')
  })

  it('explains a refused camera rather than showing a black rectangle', async () => {
    stubCamera({ allow: false })
    show(async () => true)
    await flush()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Camera access was declined'),
    )
  })

  it('stops the camera when it closes', async () => {
    const { unmount } = show(async () => true)
    await flush()
    unmount()
    expect(stopped).toBe(1)
  })
})
