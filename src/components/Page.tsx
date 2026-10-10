import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Shared page frame: sticky header, optional back link and trailing action. */
export default function Page({
  title,
  subtitle,
  backTo,
  onBack,
  action,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** Back as navigation, for a screen that is its own route. */
  backTo?: string
  /**
   * Back as an action, for a view that is component state rather than a route
   * — the ingredient picker and the photo estimator both sit inside an editor
   * and have nowhere to navigate to.
   */
  onBack?: () => void
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
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 rounded-lg p-1.5 muted hover:text-brand"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : backTo ? (
          <Link
            to={backTo}
            aria-label="Back"
            className="-ml-1 rounded-lg p-1.5 muted hover:text-brand"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        ) : null}
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
