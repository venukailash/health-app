import type { ReactNode } from 'react'

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
