import Button from './Button'

/** Opens the barcode scanner. Icon-only where space is tight. */
export default function ScanButton({
  onClick,
  label = 'Scan',
  compact = false,
}: {
  onClick: () => void
  label?: string
  compact?: boolean
}) {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      aria-label="Scan a barcode"
      className={compact ? 'shrink-0 px-3' : 'shrink-0'}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M7 8v8M10.5 8v8M14 8v8M17 8v8" />
      </svg>
      {!compact && label}
    </Button>
  )
}
