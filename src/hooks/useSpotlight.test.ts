import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSpotlight } from './useSpotlight'

/** jsdom lays nothing out, so the box has to be supplied. */
function anchor(id: string, box?: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement('div')
  element.setAttribute('data-tour', id)
  element.scrollIntoView = vi.fn()
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        ...(box ?? { top: 0, left: 0, width: 0, height: 0 }),
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => '',
      }) as DOMRect,
  )
  document.body.append(element)
  return element
}

function ringElement() {
  const node = document.createElement('div')
  document.body.append(node)
  return { current: node }
}

const frame = () => act(() => void vi.advanceTimersByTime(32))

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('useSpotlight', () => {
  it('reports nothing when there is no anchor to point at', () => {
    const { result } = renderHook(() => useSpotlight(undefined, true, ringElement()))
    expect(result.current.visible).toBe(false)
  })

  it('reports nothing while the element has not appeared', () => {
    vi.useFakeTimers()
    const ring = ringElement()
    const { result } = renderHook(() => useSpotlight('missing', true, ring))
    frame()
    expect(result.current.visible).toBe(false)
  })

  it('lays the ring over the element, padded, without re-rendering to do it', () => {
    vi.useFakeTimers()
    anchor('keys', { top: 100, left: 20, width: 200, height: 50 })
    const ring = ringElement()

    const { result } = renderHook(() => useSpotlight('keys', true, ring))
    frame()

    expect(result.current.visible).toBe(true)
    // Written straight to the node: going through state drew the ring from
    // the previous frame's numbers and it lagged the page as it scrolled.
    expect(ring.current.style.top).toBe('94px')
    expect(ring.current.style.left).toBe('14px')
    expect(ring.current.style.width).toBe('212px')
    expect(ring.current.style.height).toBe('62px')
  })

  it('treats a hidden element as nothing to point at', () => {
    vi.useFakeTimers()
    anchor('keys')
    const ring = ringElement()

    const { result } = renderHook(() => useSpotlight('keys', true, ring))
    frame()

    expect(result.current.visible).toBe(false)
  })

  it('puts the card on the side of the hole with more room', () => {
    vi.useFakeTimers()
    // Near the bottom of the window, so the room is above it.
    anchor('low', { top: window.innerHeight - 80, left: 0, width: 100, height: 40 })
    const ring = ringElement()

    const { result } = renderHook(() => useSpotlight('low', true, ring))
    frame()

    expect(result.current.cardAtTop).toBe(true)
  })

  it('scrolls once straight away, then leaves a gap before trying again', () => {
    vi.useFakeTimers()
    const element = anchor('keys', { top: 10, left: 10, width: 10, height: 10 })
    const ring = ringElement()

    renderHook(() => useSpotlight('keys', true, ring))
    frame()
    frame()
    frame()

    // Off-centre on every frame, but a smooth scroll is given time to land.
    expect(element.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('stops trying once it has landed near the middle', () => {
    vi.useFakeTimers()
    const middle = Math.round(window.innerHeight / 2)
    const element = anchor('keys', { top: middle - 25, left: 0, width: 100, height: 50 })
    const ring = ringElement()

    renderHook(() => useSpotlight('keys', true, ring))
    for (let i = 0; i < 40; i++) frame()

    expect(element.scrollIntoView).not.toHaveBeenCalled()
  })

  it('gives up scrolling once the reader scrolls for themselves', () => {
    vi.useFakeTimers()
    const element = anchor('keys', { top: 10, left: 10, width: 10, height: 10 })
    const ring = ringElement()

    renderHook(() => useSpotlight('keys', true, ring))
    frame()
    expect(element.scrollIntoView).toHaveBeenCalledTimes(1)

    act(() => void window.dispatchEvent(new Event('wheel')))
    for (let i = 0; i < 40; i++) frame()

    expect(element.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('reports nothing while it is switched off', () => {
    vi.useFakeTimers()
    anchor('keys', { top: 10, left: 10, width: 10, height: 10 })
    const ring = ringElement()

    const { result } = renderHook(() => useSpotlight('keys', false, ring))
    frame()

    expect(result.current.visible).toBe(false)
  })
})
