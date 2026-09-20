const SIZE = 168
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CalorieRing({
  consumed,
  target,
}: {
  consumed: number
  target: number
}) {
  const percent = target > 0 ? (consumed / target) * 100 : 0
  // The arc caps at a full circle; the number below it does not, so going
  // over goal is still readable at a glance.
  const swept = Math.min(percent, 100)
  const remaining = Math.round(target - consumed)
  const over = remaining < 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${Math.round(consumed)} of ${Math.round(target)} kcal, ${Math.round(percent)}% of goal`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--track)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={over ? 'var(--color-over)' : 'var(--color-kcal)'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - swept / 100)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums">{Math.round(consumed)}</span>
          <span className="text-xs muted">of {Math.round(target)} kcal</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium" style={{ color: over ? 'var(--color-over)' : undefined }}>
        {over ? `${Math.abs(remaining)} kcal over goal` : `${remaining} kcal left`}
      </p>
    </div>
  )
}
