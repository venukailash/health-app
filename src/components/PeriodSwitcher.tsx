import { Link } from 'react-router-dom'

/** Day / Week / Month, keeping the currently selected date across the switch. */
export default function PeriodSwitcher({
  active,
  date,
}: {
  active: 'day' | 'week' | 'month'
  date: string
}) {
  const tabs = [
    { key: 'day', label: 'Day', to: `/day/${date}` },
    { key: 'week', label: 'Week', to: `/week/${date}` },
    { key: 'month', label: 'Month', to: `/month/${date}` },
  ] as const

  return (
    <div
      className="mb-4 flex gap-1 rounded-xl p-1"
      style={{ background: 'var(--track)' }}
      role="tablist"
      aria-label="Time period"
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
