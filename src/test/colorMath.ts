/**
 * Colour maths for the palette checker in `themes.test.ts`.
 *
 * Test-only: the app never converts a colour, it just names tokens. This
 * exists so a new theme is judged by numbers rather than by eye, which is the
 * rule in CLAUDE.md.
 */

export interface Oklch {
  l: number
  c: number
  h: number
}

export type Rgb = [number, number, number]

/** Parses `oklch(0.52 0.11 185)`. Returns null for anything else. */
export function parseOklch(value: string): Oklch | null {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim())
  if (!match) return null
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) }
}

/** Linear-light sRGB. Values outside 0..1 are out of gamut and left as they are. */
export function toLinearRgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)

  const lp = l + 0.3963377774 * a + 0.2158037573 * b
  const mp = l - 0.1055613458 * a - 0.0638541728 * b
  const sp = l - 0.0894841775 * a - 1.291485548 * b

  const L = lp ** 3
  const M = mp ** 3
  const S = sp ** 3

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

export function inGamut(rgb: Rgb): boolean {
  return rgb.every((channel) => channel >= -0.001 && channel <= 1.001)
}

/**
 * What an sRGB screen actually shows for an `oklch()` value: chroma is reduced
 * until the colour fits, which is what browsers do. Every check runs on this
 * rather than on the written value, because the written value is not what the
 * eye gets — several of the macro hues sit just outside sRGB.
 */
export function toDisplayRgb(colour: Oklch): Rgb {
  const direct = toLinearRgb(colour)
  if (inGamut(direct)) return direct

  let low = 0
  let high = colour.c
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (inGamut(toLinearRgb({ ...colour, c: mid }))) low = mid
    else high = mid
  }
  return toLinearRgb({ ...colour, c: low }).map(clamp) as Rgb
}

/** How much chroma an sRGB screen has to throw away to show this colour. */
export function chromaLost(colour: Oklch): number {
  if (inGamut(toLinearRgb(colour))) return 0
  let low = 0
  let high = colour.c
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (inGamut(toLinearRgb({ ...colour, c: mid }))) low = mid
    else high = mid
  }
  return colour.c - low
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(clamp)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two linear-light colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la >= lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Machado, Oliveira & Fernandes (2009) severity-1.0 matrices, applied to
 * linear-light sRGB. Simulating the extreme is the point: a palette that
 * survives dichromacy survives the milder anomalous forms.
 */
const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const

export type Vision = 'normal' | keyof typeof CVD_MATRICES

export function simulate(rgb: Rgb, vision: Vision): Rgb {
  if (vision === 'normal') return rgb
  const m = CVD_MATRICES[vision]
  return [
    m[0][0] * rgb[0] + m[0][1] * rgb[1] + m[0][2] * rgb[2],
    m[1][0] * rgb[0] + m[1][1] * rgb[1] + m[1][2] * rgb[2],
    m[2][0] * rgb[0] + m[2][1] * rgb[1] + m[2][2] * rgb[2],
  ]
}

function toXyz(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(clamp)
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ]
}

const WHITE: Rgb = [0.95047, 1, 1.08883]

export function toLab(rgb: Rgb): Rgb {
  const xyz = toXyz(rgb)
  const f = xyz.map((value, index) => {
    const ratio = value / WHITE[index]
    return ratio > 216 / 24389 ? Math.cbrt(ratio) : (841 / 108) * ratio + 4 / 29
  })
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
}

/** CIEDE2000, the perceptual difference the separation floors are stated in. */
export function deltaE2000(lab1: Rgb, lab2: Rgb): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const rad = Math.PI / 180
  const deg = 180 / Math.PI

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))

  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)

  const hp = (b: number, a: number) => {
    if (b === 0 && a === 0) return 0
    const angle = Math.atan2(b, a) * deg
    return angle >= 0 ? angle : angle + 360
  }
  const h1p = hp(b1, a1p)
  const h2p = hp(b2, a2p)

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2)

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let hbarp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp += h1p + h2p < 360 ? 360 : -360
    hbarp /= 2
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad)

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2)
  const Sc = 1 + 0.045 * Cbarp
  const Sh = 1 + 0.015 * Cbarp * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc

  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  )
}

/** Perceptual distance between two OKLCH colours as a given eye would see them. */
export function separation(a: Oklch, b: Oklch, vision: Vision = 'normal'): number {
  return deltaE2000(
    toLab(simulate(toDisplayRgb(a), vision)),
    toLab(simulate(toDisplayRgb(b), vision)),
  )
}

/** WCAG contrast between two OKLCH colours as an sRGB screen shows them. */
export function contrastOf(a: Oklch, b: Oklch): number {
  return contrast(toDisplayRgb(a), toDisplayRgb(b))
}
