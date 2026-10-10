import { useEffect } from 'react'
import { DEFAULT_COLOR_MODE, DEFAULT_THEME, type ColorMode, type ThemeId } from '../domain/themes'

/**
 * Puts the chosen theme and mode on <html>, where `themes.css` picks them up.
 *
 * The same two attributes are set by a tiny inline script in index.html before
 * the bundle loads, so a dark-mode user never gets a white flash. This hook is
 * what keeps them in step afterwards.
 */
function toHex(colour: string): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    // Painting it and reading the pixel back is the only conversion that is
    // guaranteed to land in sRGB: `fillStyle` hands modern colour syntax back
    // unchanged, which is exactly what we are trying to get rid of.
    context.fillStyle = colour
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return null
  }
}

export function useAppearance(theme: ThemeId | undefined, mode: ColorMode | undefined): void {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme ?? DEFAULT_THEME

    if (!mode || mode === DEFAULT_COLOR_MODE) delete root.dataset.mode
    else root.dataset.mode = mode
  }, [theme, mode])

  // iOS tints the status bar of an installed web app from this, so it has to
  // follow the surface or the top of the screen belongs to the old theme.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return

    const sync = () => {
      const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
      if (!surface) return
      // theme-color is parsed by the OS, which may not know oklch(). A canvas
      // resolves any colour the browser understands down to a plain hex.
      meta.setAttribute('content', toHex(surface) ?? surface)
    }

    sync()
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener('change', sync)
    return () => media?.removeEventListener('change', sync)
  }, [theme, mode])
}
