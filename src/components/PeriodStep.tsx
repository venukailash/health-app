import { Link } from 'react-router-dom'

/**
 * One step backwards or forwards through days, weeks or months.
 *
 * Forward steps past the current period are rendered as plain text rather
 * than links: there is nothing to log in the future, so an empty screen with
 * a working Next button on it is an invitation to keep pressing and find
 * nothing. Kept in the row rather than removed so the layout does not shift
 * when it turns itself off.
 */
export default function PeriodStep({
  to,
  label,
  disabled,
}: {
  to: string
  label: string
  disabled?: boolean
}) {
  const shape = 'min-w-0 shrink truncate rounded-xl px-2.5 py-1.5 text-xs font-medium'

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${shape} muted opacity-40`}>
        {label}
      </span>
    )
  }

  return (
    <Link to={to} className={`card ${shape} hover:border-brand`}>
      {label}
    </Link>
  )
}
