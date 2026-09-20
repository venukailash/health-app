import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:opacity-90',
  secondary: 'card hover:border-brand',
  danger: 'text-white hover:opacity-90',
  ghost: 'muted hover:text-brand',
}

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      style={variant === 'danger' ? { background: 'var(--color-over)' } : props.style}
    />
  )
}
