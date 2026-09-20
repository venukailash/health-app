import type { ReactNode } from 'react'

/** Label above, value below. Proportional figures — these are display numbers. */
export default function StatTile({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail?: string
}) {
  return (
    <div className="rounded-xl px-3 py-3 text-center" style={{ background: 'var(--track)' }}>
      <dt className="text-xs muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold">{value}</dd>
      {detail && <p className="mt-0.5 text-[11px] muted">{detail}</p>}
    </div>
  )
}
