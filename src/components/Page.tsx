import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Shared page frame: sticky header, optional back link and trailing action. */
export default function Page({
  title,
  subtitle,
  backTo,
  action,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  backTo?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <header
        className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b px-4 py-3 backdrop-blur"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--surface) 96%, transparent)',
        }}
      >
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="-ml-1 rounded-lg p-1.5 muted hover:text-brand"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-sm muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}
