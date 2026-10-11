import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/*
 * Padding is chosen here rather than passed in. A `px-3` handed over in
 * `className` loses to the `px-4` in the base: Tailwind decides which wins by
 * the order of its own stylesheet, not the order of the class attribute, so
 * the override silently does nothing.
 */
const PADDING = { normal: 'px-4', compact: 'px-2.5' } as const

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90',
  secondary: 'card hover:border-brand',
  danger: 'text-over-ink hover:opacity-90',
  ghost: 'muted hover:text-brand',
}

export default function Button({
  variant = 'primary',
  compact = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; compact?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE} ${PADDING[compact ? 'compact' : 'normal']} ${VARIANTS[variant]} ${className}`}
      style={variant === 'danger' ? { background: 'var(--color-over)' } : props.style}
    />
  )
}
