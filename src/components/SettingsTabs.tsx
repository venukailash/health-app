import { Link } from 'react-router-dom'

/** Targets (what you are aiming for) vs App (how the app behaves). */
export default function SettingsTabs({ active }: { active: 'targets' | 'app' }) {
  const tabs = [
    { key: 'targets', label: 'Targets', to: '/settings/targets' },
    { key: 'app', label: 'App', to: '/settings/app' },
  ] as const

  return (
    <div
      className="mb-4 flex gap-1 rounded-xl p-1"
      style={{ background: 'var(--track)' }}
      role="tablist"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          role="tab"
          aria-selected={active === tab.key}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            active === tab.key ? 'text-brand' : 'muted'
          }`}
          style={active === tab.key ? { background: 'var(--surface-raised)' } : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
