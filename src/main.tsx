import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { AppStoreProvider } from './state/AppStore.tsx'
import './index.css'

// HashRouter, not BrowserRouter: GitHub Pages serves static files with no
// SPA rewrite, so a refresh on /foods would 404 under path-based routing.
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AppStoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppStoreProvider>
  </StrictMode>,
)
