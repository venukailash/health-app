import { useId } from 'react'

/**
 * Numeric input that keeps the raw string while typing, so clearing the box
 * or typing "0." does not fight the user. Commits a number on every change.
 */
export default function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 'any',
  min = 0,
  hint,
  required,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  suffix?: string
  step?: string | number
  min?: number
  hint?: string
  required?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="field"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          required={required}
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          style={suffix ? { paddingRight: '3rem' } : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs muted">{hint}</p>}
    </div>
  )
}
