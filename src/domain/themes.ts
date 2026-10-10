/**
 * The fixed set of themes. Adding one means adding a block to `themes.css`
 * and an entry here; `themes.test.ts` checks the numbers for both.
 */

export const THEMES = [
  { id: 'teal', name: 'Teal' },
  { id: 'forest', name: 'Forest' },
  { id: 'rose', name: 'Rose' },
  { id: 'steel', name: 'Steel' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'teal'

export const COLOR_MODES = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
] as const

export type ColorMode = (typeof COLOR_MODES)[number]['id']

export const DEFAULT_COLOR_MODE: ColorMode = 'system'

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value)
}

export function isColorMode(value: unknown): value is ColorMode {
  return COLOR_MODES.some((mode) => mode.id === value)
}
