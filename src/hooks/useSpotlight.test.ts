import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSpotlight } from './useSpotlight'

/** jsdom lays nothing out, so the box has to be supplied. */
function anchor(id: string, box?: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement('div')
  element.setAttribute('data-tour', id)
  element.scrollIntoView = vi.fn()
  element.getBoundingClientRect = vi.fn(
    () => ({ ...(box ?? { top: 0, left: 0, width: 0, height: 0 }), right: 0, bottom: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect,
  )
  document.body.append(element)
  return element
}

const frame = () => act(() => void vi.advanceTimersByTime(32))

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('useSpotlight', () => {
  it('reports nothing when there is no anchor to point at', () => {
    const { result } = renderHook(() => useSpotlight(undefined, true))
    expect(result.current).toBeNull()
  })

  it('reports nothing while the element has not appeared', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSpotlight('missing', true))
    frame()
    expect(result.current).toBeNull()
  })

  it('surrounds the element once it is there', () => {
    vi.useFakeTimers()
    anchor('keys', { top: 100, left: 20, width: 200, height: 50 })

    const { result } = renderHook(() => useSpotlight('keys', true))
    frame()

    // Padded by 8px on every side so the ring does not sit on the content.
    expect(result.current).toEqual({ top: 92, left: 12, width: 216, height: 66 })
  })

  it('treats a hidden element as nothing to point at', () => {
    vi.useFakeTimers()
    anchor('keys')

    const { result } = renderHook(() => useSpotlight('keys', true))
    frame()

    expect(result.current).toBeNull()
  })

  it('scrolls once straight away, then leaves a gap before trying again', () => {
    vi.useFakeTimers()
    const element = anchor('keys', { top: 10, left: 10, width: 10, height: 10 })

    renderHook(() => useSpotlight('keys', true))
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

    renderHook(() => useSpotlight('keys', true))
    for (let i = 0; i < 40; i++) frame()

    expect(element.scrollIntoView).not.toHaveBeenCalled()
  })

  it('gives up scrolling once the reader scrolls for themselves', () => {
    vi.useFakeTimers()
    const element = anchor('keys', { top: 10, left: 10, width: 10, height: 10 })

    renderHook(() => useSpotlight('keys', true))
    frame()
    expect(element.scrollIntoView).toHaveBeenCalledTimes(1)

    act(() => void window.dispatchEvent(new Event('wheel')))
    for (let i = 0; i < 40; i++) frame()

    expect(element.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('reports nothing while it is switched off', () => {
    vi.useFakeTimers()
    anchor('keys', { top: 10, left: 10, width: 10, height: 10 })

    const { result } = renderHook(() => useSpotlight('keys', false))
    frame()

    expect(result.current).toBeNull()
  })
})
