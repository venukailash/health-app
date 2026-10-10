import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, Link, useNavigate } from 'react-router-dom'
import ScrollManager from './ScrollManager'

const Screen = ({ name }: { name: string }) => {
  const navigate = useNavigate()
  return (
    <div>
      <p>{name}</p>
      <Link to="/second">go second</Link>
      <button type="button" onClick={() => navigate(-1)}>
        go back
      </button>
    </div>
  )
}

const app = () =>
  render(
    <MemoryRouter initialEntries={['/first']}>
      <ScrollManager />
      <Routes>
        <Route path="/first" element={<Screen name="first" />} />
        <Route path="/second" element={<Screen name="second" />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
})

describe('ScrollManager', () => {
  it('starts at the top on first render', () => {
    app()
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('starts a newly opened screen at the top', async () => {
    const user = userEvent.setup()
    app()
    vi.mocked(window.scrollTo).mockClear()

    await user.click(screen_link('go second'))
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('returns to where you were when going back', async () => {
    const user = userEvent.setup()
    app()

    // Scroll down the first screen, then navigate away.
    ;(window as unknown as { scrollY: number }).scrollY = 420
    window.dispatchEvent(new Event('scroll'))
    await user.click(screen_link('go second'))

    vi.mocked(window.scrollTo).mockClear()
    // MemoryRouter keeps its own history, so go back through the router.
    const back = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'go back',
    ) as HTMLElement
    await user.click(back)

    // Back restores; it does not dump you at the top of a list you had
    // already worked through.
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420)
  })
})

function screen_link(text: string): HTMLElement {
  const links = [...document.querySelectorAll('a')]
  const found = links.find((link) => link.textContent === text)
  if (!found) throw new Error(`no link: ${text}`)
  return found
}
