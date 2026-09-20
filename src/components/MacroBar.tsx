import { round } from '../domain/nutrition'
import type { Progress } from '../state/selectors'

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
            style={{ background: progress.over ? 'var(--color-over)' : color }}
          />
          {label}
        </span>
        <span className="tabular-nums muted">
          {round(progress.consumed, decimals)} / {round(progress.target, decimals)} {unit}
          <span
            className="ml-2 font-medium"
            style={{ color: progress.over ? 'var(--color-over)' : 'var(--text)' }}
          >
            {progress.percent}%
          </span>
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--track)' }}
        role="progressbar"
        aria-label={`${label}: ${progress.percent}% of goal`}
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${width}%`, background: progress.over ? 'var(--color-over)' : color }}
        />
      </div>
    </div>
  )
}
