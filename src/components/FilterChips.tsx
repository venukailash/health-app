import type { ReactNode } from 'react'

export interface FilterOption<T> {
  value: T
  label: ReactNode
}

/**
 * A single row of filters that scrolls sideways rather than wrapping.
 *
 * Wrapping was the alternative, but a dozen food categories wrap to four lines
 * and push the list itself off the screen. Sideways keeps the row one line
 * tall whatever the number of options, and bleeds to the screen edges so it
 * reads as scrollable rather than clipped.
 */
export default function FilterChips<T extends string | null>({
  options,
  value,
  onChange,
  label,
}: {
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // Negative margin so the row runs to the screen edges on a phone.
      className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              on ? 'bg-brand text-white' : ''
            }`}
            style={on ? undefined : { background: 'var(--track)' }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
