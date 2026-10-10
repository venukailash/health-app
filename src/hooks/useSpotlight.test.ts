import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSpotlight } from './useSpotlight'

/** jsdom lays nothing out, so the box has to be supplied. */
function anchor(id: string, box?: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement('div')
  element.setAttribute('data-tour', id)
  element.scrollIntoView = vi.fn()
  const { top, left, width, height } = box ?? { top: 0, left: 0, width: 0, height: 0 }
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
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

  it('leaves the card alone for a target the page can scroll', () => {
    vi.useFakeTimers()
    anchor('low', { top: window.innerHeight - 80, left: 0, width: 100, height: 40 })
    const ring = ringElement()

    const { result } = renderHook(() => useSpotlight('low', true, ring))
    frame()

    expect(result.current.lift).toBe(0)
  })

  it('lifts the card off a target pinned to the bottom of the screen', () => {
    vi.useFakeTimers()
    // The floating assist button: fixed, so no scroll can move it out from
    // under a bottom sheet.
    const element = anchor('pinned', { top: window.innerHeight - 80, left: 0, width: 56, height: 56 })
    element.style.position = 'fixed'
    const ring = ringElement()

    const { result } = renderHook(() => useSpotlight('pinned', true, ring))
    frame()

    expect(result.current.lift).toBeGreaterThan(80)
    expect(element.scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls a target into the band above the card, not the middle', () => {
    vi.useFakeTimers()
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)
    // Well below where it should end up, so a scroll is called for.
    anchor('far', { top: window.innerHeight - 100, left: 0, width: 100, height: 40 })
    const ring = ringElement()

    renderHook(() => useSpotlight('far', true, ring))
    frame()

    expect(scrollBy).toHaveBeenCalledTimes(1)
    const moved = scrollBy.mock.calls[0][0].top
    // Lands in the upper 55% of the window, where the card is not.
    const landedTop = window.innerHeight - 100 - moved
    expect(landedTop).toBeLessThan(window.innerHeight * 0.55)
    vi.unstubAllGlobals()
  })

  it('scrolls once straight away, then leaves a gap before trying again', () => {
    vi.useFakeTimers()
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)
    anchor('keys', { top: window.innerHeight - 40, left: 10, width: 10, height: 10 })
    const ring = ringElement()

    renderHook(() => useSpotlight('keys', true, ring))
    frame()
    frame()
    frame()

    // Out of place on every frame, but a smooth scroll is given time to land.
    expect(scrollBy).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('stops trying once it has landed where it belongs', () => {
    vi.useFakeTimers()
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)
    // Already centred in the band above the card.
    const band = window.innerHeight * 0.55
    anchor('keys', { top: Math.round((band - 50) / 2), left: 0, width: 100, height: 50 })
    const ring = ringElement()

    renderHook(() => useSpotlight('keys', true, ring))
    for (let i = 0; i < 40; i++) frame()

    expect(scrollBy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('gives up scrolling once the reader scrolls for themselves', () => {
    vi.useFakeTimers()
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)
    anchor('keys', { top: window.innerHeight - 40, left: 10, width: 10, height: 10 })
    const ring = ringElement()

    renderHook(() => useSpotlight('keys', true, ring))
    frame()
    expect(scrollBy).toHaveBeenCalledTimes(1)

    act(() => void window.dispatchEvent(new Event('wheel')))
    for (let i = 0; i < 40; i++) frame()

    expect(scrollBy).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
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
