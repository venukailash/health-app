import { Link } from 'react-router-dom'

/**
 * One step backwards or forwards through days, weeks or months.
 *
 * Forward steps past the current period are rendered as plain text rather
 * than links: there is nothing to log in the future, so an empty screen with
 * a working Next button on it is an invitation to keep pressing and find
 * nothing. Kept in the row rather than removed so the layout does not shift
 * when it turns itself off.
 *
 * Takes half the free width whatever its label, which is what holds whatever
 * sits between the two steps in the middle of the row.
 */
export default function PeriodStep({
  to,
  label,
  align,
  disabled,
}: {
  to: string
  label: string
  /** Which end of the row it hugs. */
  align: 'start' | 'end'
  disabled?: boolean
}) {
  const shape = 'min-w-0 truncate rounded-xl px-2.5 py-1.5 text-xs font-medium'

  return (
    /*
     * Each side takes an equal share of the row, whatever its label says, so
     * the control between them stays dead centre. Sizing the sides by their
     * text instead moved the Insights button left and right as you walked
     * from "Yesterday" to "September" to "June", which read as a wobble.
     */
    <div
      className={`flex min-w-0 flex-1 basis-0 ${align === 'start' ? 'justify-start' : 'justify-end'}`}
    >
      {disabled ? (
        <span aria-disabled="true" className={`${shape} muted opacity-40`}>
          {label}
        </span>
      ) : (
        <Link to={to} className={`card ${shape} hover:border-brand`}>
          {label}
        </Link>
      )}
    </div>
  )
}
