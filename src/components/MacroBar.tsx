import { round } from '../domain/nutrition'
import type { Progress } from '../state/selectors'

/**
 * One macro's progress toward its daily target.
 *
 * The fill always wears the macro's own hue, never the status colour: fat is
 * already a red, so repainting it red when over goal would make identity and
 * status indistinguishable. Over-goal is carried by an icon plus the
 * percentage in the status colour — never by colour alone.
 */
export default function MacroBar({
  label,
  progress,
  color,
  unit = 'g',
  indent = false,
}: {
  label: string
  progress: Progress
  /** A CSS colour, usually a --color-* token from the theme. */
  color: string
  unit?: string
  indent?: boolean
}) {
  const width = Math.min(progress.percent, 100)
  const decimals = unit === 'g' && progress.target < 20 ? 2 : 1

  return (
    <div className={indent ? 'pl-4' : undefined}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: color }}
          />
          {label}
        </span>
        <span className="tabular-nums muted">
          {round(progress.consumed, decimals)} / {round(progress.target, decimals)} {unit}
          <span
            className="ml-2 inline-flex items-center gap-1 font-medium"
            style={{ color: progress.over ? 'var(--color-over)' : 'var(--text)' }}
          >
            {progress.over && (
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label="over goal"
              >
                <path d="M12 3L2 20h20L12 3zM12 10v4M12 17.5v.01" />
              </svg>
            )}
            {progress.percent}%
          </span>
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--track)' }}
        role="progressbar"
        aria-label={`${label}: ${progress.percent}% of goal${progress.over ? ', over goal' : ''}`}
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  )
}
