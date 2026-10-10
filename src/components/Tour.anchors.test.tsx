import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import AppSettingsPage from '../pages/AppSettingsPage'
import QuickAddButton from './QuickAddButton'
import TargetsSettingsPage from '../pages/TargetsSettingsPage'
import TodayPage from '../pages/TodayPage'
import { renderWithApp } from '../test/renderWithApp'
import { TOUR_STEPS } from '../domain/tour'
import { DEFAULT_GOALS } from '../storage/repository'
import { AppStoreProvider } from '../state/AppStore'
import { ToastProvider } from '../state/ToastProvider'
import { EMPTY_STATE } from '../state/reducer'

/**
 * The tour points at real elements by `data-tour`. Nothing in the type system
 * ties the two together, so this is what does: delete an anchor and a test
 * named after it fails, rather than the highlight quietly going missing for
 * everyone on their first run.
 */

const DATE = '2026-10-10'

const renders: Record<string, () => void> = {
  'fdc-key': () => {
    renderWithApp(<AppSettingsPage />, { path: '/settings/app', route: '/settings/app' })
  },
  'gemini-key': () => {
    renderWithApp(<AppSettingsPage />, { path: '/settings/app', route: '/settings/app' })
  },
  'daily-targets': () => {
    renderWithApp(<TargetsSettingsPage />, {
      path: '/settings/targets',
      route: '/settings/targets',
      state: { goals: DEFAULT_GOALS },
    })
  },
  'add-to-meal': () => {
    renderWithApp(<TodayPage />, {
      path: '/day/:date',
      route: `/day/${DATE}`,
      state: { goals: DEFAULT_GOALS },
    })
  },
  'quick-add': () => {
    // Rendered on a top-level route, which is the only place it appears.
    render(
      <ToastProvider>
        <AppStoreProvider initialState={EMPTY_STATE}>
          <MemoryRouter initialEntries={[`/day/${DATE}`]}>
            <QuickAddButton />
          </MemoryRouter>
        </AppStoreProvider>
      </ToastProvider>,
    )
  },
}

describe('every anchor the tour points at exists', () => {
  const anchors = TOUR_STEPS.map((step) => step.anchor).filter(
    (anchor): anchor is string => anchor !== undefined,
  )

  it('has a way to render each one', () => {
    expect(Object.keys(renders).sort()).toEqual([...anchors].sort())
  })

  for (const anchor of anchors) {
    it(`finds [data-tour="${anchor}"]`, () => {
      renders[anchor]()
      expect(document.querySelector(`[data-tour="${anchor}"]`)).not.toBeNull()
    })
  }
})
