import { useEffect, useState } from 'react'

/**
 * Whether the device appears to have a camera.
 *
 * Used to decide if offering "Take a photo" is honest. The `capture` attribute
 * is silently ignored on desktop, so a camera button there opens a file dialog
 * and does exactly what the other button does — two identical-looking buttons
 * doing the same thing is worse than one.
 *
 * `enumerateDevices` reports device *kinds* without permission (labels stay
 * empty until granted), which is all this needs. Anything unexpected assumes a
 * camera IS present: offering it and having it fall back to a file dialog is a
 * smaller failure than hiding it from someone who has one.
 */
export function useHasCamera(): boolean {
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    let cancelled = false
    const devices = navigator.mediaDevices

    if (!devices?.enumerateDevices) {
      // iOS Safari in some contexts exposes no mediaDevices at all, yet still
      // honours capture= on a file input. Assume a camera.
      return
    }

    devices
      .enumerateDevices()
      .then((list) => {
        if (!cancelled) setHasCamera(list.some((device) => device.kind === 'videoinput'))
      })
      .catch(() => {
        if (!cancelled) setHasCamera(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return hasCamera
}
