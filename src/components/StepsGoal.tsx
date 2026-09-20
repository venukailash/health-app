import { round } from '../domain/nutrition'

/**
 * Steps against target. A bar rather than a ring: the calorie ring is the one
 * hero figure on the dashboard, and a second ring would compete with it.
 */
export default function StepsGoal({
  steps,
  target,
  label = 'Steps',
  caption,
}: {
  steps: number | null
  target: number
  label?: string
  caption?: string
}) {
  const recorded = steps !== null
  const percent = target > 0 && recorded ? Math.round((steps / target) * 100) : 0
  const met = recorded && target > 0 && steps >= target

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--color-steps)' }}
          />
          {label}
        </span>
        <span className="tabular-nums muted">
          {recorded ? (
            <>
              {steps.toLocaleString()} / {target.toLocaleString()}
              <span
                className="ml-2 inline-flex items-center gap-1 font-medium"
                style={{ color: met ? 'var(--color-steps)' : 'var(--text)' }}
              >
                {met && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="target met">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {percent}%
              </span>
            </>
          ) : (
            <span>Not recorded</span>
          )}
        </span>
      </div>

      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--track)' }}
        role="progressbar"
        aria-label={
          recorded ? `${label}: ${percent}% of target` : `${label}: nothing recorded`
        }
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: 'var(--color-steps)',
          }}
        />
      </div>

      {caption && <p className="mt-1.5 text-xs muted">{caption}</p>}
      {recorded && target > 0 && !met && (
        <p className="mt-1.5 text-xs muted">
          {round(target - steps, 0).toLocaleString()} steps to go
        </p>
      )}
    </div>
  )
}
