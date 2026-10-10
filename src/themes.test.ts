/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES, type ThemeId } from './domain/themes'
import { STORAGE_KEYS } from './storage/repository'
import {
  chromaLost,
  contrastOf,
  parseOklch,
  separation,
  type Oklch,
  type Vision,
} from './test/colorMath'

/**
 * The palette is checked, not eyeballed — CLAUDE.md rule 5. This reads
 * `themes.css` itself rather than a copy of the numbers, so a theme cannot
 * pass here and ship something else.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

// Comments go first: they contain commas, and selector lists are split on them.
// `?raw` is not an option: the Tailwind plugin claims .css imports.
const css = read('src/themes.css').replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Reads every flat `selector { --token: oklch(...) }` block and indexes the
 * declarations by each selector in the list, so a block written for both
 * `:root` and `[data-theme='teal']` is found under either. The mapping rules
 * further down the file hold no colour values, so they contribute nothing.
 */
const DECLARATIONS = (() => {
  const bySelector = new Map<string, Record<string, Oklch>>()

  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const tokens: Record<string, Oklch> = {}
    for (const [, name, value] of body.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)) {
      const colour = parseOklch(value)
      if (!colour) throw new Error(`unparsed colour ${name}: ${value}`)
      tokens[name] = colour
    }
    if (Object.keys(tokens).length === 0) continue

    for (const selector of selectors.split(',')) {
      const key = selector.trim()
      if (!key) continue
      bySelector.set(key, { ...bySelector.get(key), ...tokens })
    }
  }

  return bySelector
})()

function block(selector: string): Record<string, Oklch> {
  const tokens = DECLARATIONS.get(selector)
  if (!tokens) throw new Error(`no block for ${selector}`)
  return tokens
}

// `:root` carries the teal theme AND the shared macro hues; a named theme
// block overrides the chrome and inherits the rest.
const base = block(':root')
const themeBlocks = new Map<ThemeId, Record<string, Oklch>>(
  THEMES.map((theme) => [
    theme.id,
    theme.id === 'teal' ? base : { ...base, ...block(`[data-theme='${theme.id}']`) },
  ]),
)

type Mode = 'l' | 'd'
const MODES: Mode[] = ['l', 'd']
const MODE_NAMES = { l: 'light', d: 'dark' } as const

const MACRO_KEYS = ['carbs', 'fibre', 'protein', 'fat', 'satfat', 'salt'] as const
/** The four that are their own category. Fibre and satfat are ordinal steps. */
const CATEGORICAL = ['carbs', 'protein', 'fat', 'salt'] as const

function tokens(theme: ThemeId, mode: Mode) {
  const own = themeBlocks.get(theme)
  if (!own) throw new Error(`no theme ${theme}`)
  const get = (name: string) => {
    const value = own[`${mode}-${name}`]
    if (!value) throw new Error(`${theme}/${MODE_NAMES[mode]} is missing --${mode}-${name}`)
    return value
  }
  return { get }
}

describe('every theme ships every token', () => {
  const NAMES = [
    'surface',
    'surface-raised',
    'border',
    'text',
    'text-muted',
    'track',
    'brand',
    'brand-ink',
    'kcal',
    'heat-1',
    'heat-2',
    'heat-3',
    'heat-4',
  ]

  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme.id} ${MODE_NAMES[mode]}`, () => {
        const { get } = tokens(theme.id, mode)
        for (const name of NAMES) expect(() => get(name), `--${mode}-${name}`).not.toThrow()
      })
    }
  }
})

describe('colours survive an sRGB screen', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme.id} ${MODE_NAMES[mode]}`, () => {
        const { get } = tokens(theme.id, mode)
        const named = [
          ...['surface', 'surface-raised', 'border', 'text', 'text-muted', 'track'],
          ...['brand', 'brand-ink', 'kcal', 'heat-1', 'heat-2', 'heat-3', 'heat-4'],
          ...MACRO_KEYS.map((key) => `color-${key}`),
        ]
        for (const name of named) {
          // Wide-gamut screens show these as written; sRGB screens reduce the
          // chroma to fit. A small reduction is fine and unavoidable for a
          // vivid teal or orange. A large one means two tokens that were
          // designed apart arrive looking the same, so it is capped.
          expect(chromaLost(get(name)), `--${mode}-${name} loses chroma`).toBeLessThan(0.03)
        }
      })
    }
  }
})

describe('text is legible on its surface', () => {
  const ratio = contrastOf

  for (const theme of THEMES) {
    for (const mode of MODES) {
      const label = `${theme.id} ${MODE_NAMES[mode]}`

      it(`${label}: body text clears 7:1`, () => {
        const { get } = tokens(theme.id, mode)
        for (const surface of ['surface', 'surface-raised'] as const) {
          expect(ratio(get('text'), get(surface)), `text on ${surface}`).toBeGreaterThanOrEqual(7)
        }
      })

      it(`${label}: muted text clears 4.5:1`, () => {
        const { get } = tokens(theme.id, mode)
        for (const surface of ['surface', 'surface-raised'] as const) {
          expect(
            ratio(get('text-muted'), get(surface)),
            `muted on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      })

      it(`${label}: links and buttons clear 4.5:1 both ways`, () => {
        const { get } = tokens(theme.id, mode)
        // text-brand sits on both surfaces as a link.
        expect(ratio(get('brand'), get('surface')), 'brand on surface').toBeGreaterThanOrEqual(4.5)
        expect(
          ratio(get('brand'), get('surface-raised')),
          'brand on raised',
        ).toBeGreaterThanOrEqual(4.5)
        // ...and carries brand-ink when it is a filled button.
        expect(ratio(get('brand-ink'), get('brand')), 'ink on brand').toBeGreaterThanOrEqual(4.5)

        // The status red is a fill as well as a text colour, so it needs an
        // ink of its own: white on the lighter dark-mode red was 3.5:1.
        expect(
          ratio(get('color-over-ink'), get('color-over')),
          'ink on over',
        ).toBeGreaterThanOrEqual(4.5)
        expect(ratio(get('color-over'), get('surface')), 'over on surface').toBeGreaterThanOrEqual(
          4.5,
        )
      })

      it(`${label}: borders and bar tracks are visible`, () => {
        const { get } = tokens(theme.id, mode)
        expect(ratio(get('border'), get('surface')), 'border').toBeGreaterThanOrEqual(1.25)
        expect(ratio(get('track'), get('surface-raised')), 'track').toBeGreaterThanOrEqual(1.15)
      })
    }
  }
})

describe('chart marks stand off the surface they are drawn on', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme.id} ${MODE_NAMES[mode]}`, () => {
        const { get } = tokens(theme.id, mode)
        const marks = [...MACRO_KEYS.map((key) => `color-${key}`), 'kcal', 'heat-4']
        for (const name of marks) {
          // 2.2:1 rather than the 3:1 WCAG non-text floor: every bar also
          // carries its name and its number, so colour is reinforcement.
          expect(contrastOf(get(name), get('surface-raised')), `--${name}`).toBeGreaterThanOrEqual(
            2.2,
          )
        }

        // The quietest step of a sequential ramp has to sit near the surface
        // or the ramp has no range left. It still has to be visible as a
        // filled cell, and the month grid draws a border round every day.
        expect(contrastOf(get('heat-1'), get('surface-raised')), '--heat-1').toBeGreaterThanOrEqual(
          1.5,
        )
      })
    }
  }
})

describe('the calorie ring is not mistaken for a macro', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme.id} ${MODE_NAMES[mode]}`, () => {
        const { get } = tokens(theme.id, mode)
        for (const key of CATEGORICAL) {
          expect(
            separation(get('kcal'), get(`color-${key}`)),
            `kcal vs ${key}`,
          ).toBeGreaterThanOrEqual(12)
        }
      })
    }
  }
})

describe('the heat ramp reads as a ramp', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme.id} ${MODE_NAMES[mode]}`, () => {
        const { get } = tokens(theme.id, mode)
        const steps = [1, 2, 3, 4].map((n) => get(`heat-${n}`))
        const lightness = steps.map((step) => step.l)
        const monotone =
          lightness.every((value, i) => i === 0 || value < lightness[i - 1]) ||
          lightness.every((value, i) => i === 0 || value > lightness[i - 1])
        expect(monotone, `lightness ${lightness.join(' ')}`).toBe(true)

        for (let i = 1; i < steps.length; i++) {
          expect(
            separation(steps[i - 1], steps[i]),
            `heat-${i} vs heat-${i + 1}`,
          ).toBeGreaterThanOrEqual(8)
        }
      })
    }
  }
})

describe('the macro hues keep their separation on every surface', () => {
  // These are shared by every theme, so they are checked once per mode.
  const VISIONS: Vision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia']

  for (const mode of MODES) {
    it(`${MODE_NAMES[mode]}: fibre and saturated fat stay darker than their parent`, () => {
      const { get } = tokens('teal', mode)
      expect(get('color-carbs').l - get('color-fibre').l).toBeGreaterThanOrEqual(0.12)
      expect(get('color-fat').l - get('color-satfat').l).toBeGreaterThanOrEqual(0.12)
    })

    it(`${MODE_NAMES[mode]}: carbs, protein and fat stay apart for every eye`, () => {
      const { get } = tokens('teal', mode)
      // Blue and purple are NOT separable under red-green CVD — see
      // docs/DECISIONS.md. Salt is excluded from this floor deliberately
      // rather than the floor being lowered to hide it.
      const keys = ['carbs', 'protein', 'fat'] as const
      for (const vision of VISIONS) {
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            expect(
              separation(get(`color-${keys[i]}`), get(`color-${keys[j]}`), vision),
              `${keys[i]} vs ${keys[j]} (${vision})`,
            ).toBeGreaterThanOrEqual(6)
          }
        }
      }
    })
  }
})

describe('the no-flash script in index.html knows the same themes', () => {
  // It cannot import anything — it runs before the bundle — so the list of
  // ids is written out by hand there. This is what stops the two drifting.
  const html = read('index.html')

  it('lists every theme and nothing else', () => {
    const match = /\[([^\]]*)\]\.indexOf\(meta\.theme\)/.exec(html)
    expect(match, 'no theme list found in index.html').not.toBeNull()

    const listed = (match as RegExpExecArray)[1]
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
    expect(listed.sort()).toEqual(THEMES.map((theme) => theme.id).sort())
  })

  it('reads the key the repository writes', () => {
    expect(html).toContain(STORAGE_KEYS.meta)
  })
})
