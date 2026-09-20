import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppStoreProvider } from '../state/AppStore'
import { ToastProvider } from '../state/ToastProvider'
import { EMPTY_STATE, type AppState } from '../state/reducer'

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
  return render(
    <ToastProvider>
      <AppStoreProvider initialState={initialState}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={element} />
            <Route path="*" element={<div>redirected</div>} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    </ToastProvider>,
  )
}
