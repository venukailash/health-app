import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Tour from './Tour'
import { renderWithApp } from '../test/renderWithApp'
import { TOUR_REVISION, TOUR_STEPS } from '../domain/tour'
import { DEFAULT_META } from '../storage/repository'

const renderTour = (tourSeenRevision?: number) =>
  renderWithApp(<Tour />, { state: { meta: { ...DEFAULT_META, tourSeenRevision } } })

describe('Tour', () => {
  it('greets someone who has never seen it', () => {
    renderTour()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(`Welcome · 1 of ${TOUR_STEPS.length}`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Keep it on your home screen' })).toBeInTheDocument()
  })

  it('stays away from someone who is up to date', () => {
    renderTour(TOUR_REVISION)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('steps forwards and back through every card', async () => {
    const user = userEvent.setup()
    renderTour()
    const dialog = screen.getByRole('dialog')

    for (let step = 2; step <= TOUR_STEPS.length; step++) {
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
      expect(screen.getByText(`Welcome · ${step} of ${TOUR_STEPS.length}`)).toBeInTheDocument()
    }

    // The last card offers the way out rather than another Next.
    expect(within(dialog).queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Start logging' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(
      screen.getByText(`Welcome · ${TOUR_STEPS.length - 1} of ${TOUR_STEPS.length}`),
    ).toBeInTheDocument()
  })

  it('has no Back to press on the first card', () => {
    renderTour()
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument()
  })

  it('closes for good when skipped', async () => {
    const user = userEvent.setup()
    renderTour()

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes for good when finished', async () => {
    const user = userEvent.setup()
    renderTour()
    const dialog = screen.getByRole('dialog')

    for (let step = 2; step <= TOUR_STEPS.length; step++) {
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
    }
    await user.click(within(dialog).getByRole('button', { name: 'Start logging' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderTour()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lets the page behind it scroll again afterwards', async () => {
    const user = userEvent.setup()
    renderTour()
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('calls it what it is when only part of it is new', () => {
    // Nothing is newer than revision 0 unless a step says so, so this is the
    // shape of an upgrade rather than a first run.
    renderTour(TOUR_REVISION - 1)
    const heading = screen.queryByText(/What's new/)
    if (TOUR_STEPS.some((step) => step.since > TOUR_REVISION - 1)) {
      expect(heading).toBeInTheDocument()
    } else {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }
  })
})
