import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Progress', match: ['/day', '/week', '/month'], icon: 'M3 12h4l3 8 4-16 3 8h4' },
  { to: '/foods', label: 'Foods', icon: 'M4 4h16v6a8 8 0 0 1-16 0zM4 20h16' },
  { to: '/recipes', label: 'Recipes', icon: 'M6 3v8a3 3 0 0 0 6 0V3M9 11v10M17 3c-1.5 2-2 4-2 6s.5 3 2 3v9' },
  { to: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8' },
]

export default function NavBar() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in oklab, var(--surface-raised) 88%, transparent)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          // Today lives at /day/:date once a day is selected, so the tab
          // highlights on its own prefix rather than an exact path match.
          const active = tab.match
            ? pathname === tab.to || tab.match.some((prefix) => pathname.startsWith(prefix))
            : pathname.startsWith(tab.to)

          return (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                active ? 'text-brand' : 'muted'
              }`}
            >
                <>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 2.2 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tab.icon} />
                  </svg>
                  {tab.label}
                </>
            </NavLink>
          </li>
          )
        })}
      </ul>
    </nav>
  )
}
