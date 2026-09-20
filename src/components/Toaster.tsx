import { useToast, type ToastTone } from '../state/ToastProvider'

const TONE_COLOUR: Record<ToastTone, string> = {
  info: 'var(--color-brand)',
  error: 'var(--color-over)',
  success: 'var(--color-kcal)',
}

/** Live region for transient messages. Sits above the nav bar. */
export default function Toaster() {
  const { toasts, dismissToast } = useToast()
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center gap-2 px-4"
      style={{ bottom: `calc(5rem + env(safe-area-inset-bottom))` }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="card pointer-events-auto flex w-full max-w-md items-start gap-3 px-4 py-3 text-sm shadow-lg"
          style={{ borderLeft: `3px solid ${TONE_COLOUR[toast.tone]}` }}
        >
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                dismissToast(toast.id)
              }}
              className="shrink-0 font-semibold text-brand"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 muted hover:text-[var(--text)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
