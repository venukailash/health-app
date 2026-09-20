import Button from './Button'

/**
 * Runs the user's Shortcut through the `shortcuts://` URL scheme.
 *
 * This is the one part of the setup the app CAN automate. It cannot create the
 * Shortcut: iOS has no API for building one, `.shortcut` files are Apple
 * plists that iOS refuses to import unsigned, and the sanctioned sharing route
 * is an iCloud link that only a person on an Apple device can produce. But an
 * existing Shortcut can be launched by name, which turns the daily routine
 * into two taps: run, then paste.
 */
export default function RunShortcutButton({ name }: { name: string }) {
  const trimmed = name.trim()
  if (trimmed === '') return null

  return (
    <Button
      onClick={() => {
        window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(trimmed)}`
      }}
    >
      Run &ldquo;{trimmed}&rdquo;
    </Button>
  )
}
