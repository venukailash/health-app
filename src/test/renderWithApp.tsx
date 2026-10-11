import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppStoreProvider, useAppState } from '../state/AppStore'
import { ToastProvider } from '../state/ToastProvider'
import { EMPTY_STATE, type AppState } from '../state/reducer'

/**
 * Lets a test read the store after the thing it clicked. Rendered inside the
 * provider, so it sees exactly what the page sees.
 */
function StateProbe({ onState }: { onState: (state: AppState) => void }) {
  onState(useAppState())
  return null
}

/**
 * Renders a page inside the store and router, with state injected rather than
 * read from localStorage so tests stay independent of the seeding path.
 */
export function renderWithApp(
  element: ReactElement,
  {
    path = '/',
    route = '/',
    state,
  }: { path?: string; route?: string; state?: Partial<AppState> } = {},
) {
  const initialState: AppState = { ...EMPTY_STATE, ...state }
  let latest = initialState

  const result = render(
    <ToastProvider>
      <AppStoreProvider initialState={initialState}>
        <StateProbe onState={(next) => (latest = next)} />
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={element} />
            <Route path="*" element={<div>redirected</div>} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    </ToastProvider>,
  )

  return { ...result, store: () => latest }
}
