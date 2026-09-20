import { useEffect, useState } from 'react'

/**
 * True when running as an installed app rather than in a browser tab.
 *
 * This matters more than it looks on iOS: a Home Screen web app gets its own
 * storage partition, completely separate from Safari's. The same URL opened in
 * each place is two different databases, so anything imported into the wrong
 * one silently never appears in the other.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari predates the standard and still reports it on `navigator`.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  // matchMedia is absent under jsdom, so this has to degrade rather than throw.
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayMode
}

export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(isStandalone)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(display-mode: standalone)')
    if (typeof media.addEventListener !== 'function') return
    const update = () => setStandalone(isStandalone())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return standalone
}
