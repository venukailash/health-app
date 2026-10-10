/**
 * Renders the app icons from code, so there is no binary blob to maintain and
 * no image toolchain to install.
 *
 * The mark is a three-quarter progress arc — echoing the calorie ring on the
 * dashboard — with a fork and spoon inside it. The arc alone said "progress"
 * and nothing about food, which described half the app.
 *
 * Everything is drawn from shape predicates sampled 3x3 per pixel, so there is
 * no SVG rasteriser to install for a handful of icons.
 *
 * Run with: npm run generate-icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [15, 118, 110] // teal-700, matches the PWA theme colour
const RING = [255, 255, 255]
const TRACK = [255, 255, 255, 0.28]

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(buffer) {
  let crc = 0xff_ff_ff_ff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xff_ff_ff_ff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  // Each scanline is prefixed with a filter byte; 0 means "no filter".
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Coverage of a pixel by a shape, sampled 3x3 for cheap anti-aliasing. */
function coverage(x, y, inside) {
  let hits = 0
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      if (inside(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hits += 1
    }
  }
  return hits / 9
}

function blend(target, offset, colour, alpha) {
  if (alpha <= 0) return
  const [r, g, b, a = 1] = colour
  const strength = alpha * a
  for (const [channel, value] of [r, g, b].entries()) {
    const current = target[offset + channel]
    target[offset + channel] = Math.round(current + (value - current) * strength)
  }
  target[offset + 3] = Math.max(target[offset + 3], Math.round(255 * strength))
}

function render(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const centre = size / 2
  // A maskable icon must survive a circular crop, so the mark shrinks and the
  // background fills the whole square.
  const pad = maskable ? 0 : size * 0.06
  const radius = maskable ? size : size * 0.22
  const ringRadius = size * (maskable ? 0.26 : 0.3)
  // Thinner than before: the ring is now a frame around the cutlery rather
  // than the whole mark, and a fat ring crowds it.
  const ringWidth = size * (maskable ? 0.07 : 0.08)

  const insideBackground = (x, y) => {
    if (maskable) return true
    const left = pad
    const right = size - pad
    const cx = Math.min(Math.max(x, left + radius), right - radius)
    const cy = Math.min(Math.max(y, left + radius), right - radius)
    return Math.hypot(x - cx, y - cy) <= radius || (x >= left && x <= right && y >= left && y <= right && (x >= left + radius && x <= right - radius) === false ? false : x >= left && x <= right && y >= left && y <= right)
  }

  const onRing = (x, y) => {
    const distance = Math.hypot(x - centre, y - centre)
    return Math.abs(distance - ringRadius) <= ringWidth / 2
  }

  /* --- cutlery, sized against the ring so it scales with the icon --- */

  const unit = ringRadius
  const stemTop = centre - unit * 0.46
  const stemBottom = centre + unit * 0.52
  const stemHalf = unit * 0.062
  const gap = unit * 0.30

  /** A vertical bar with rounded ends. */
  const bar = (cx, top, bottom, half) => (x, y) => {
    if (Math.abs(x - cx) > half) return false
    if (y >= top && y <= bottom) return true
    // Round the ends.
    const end = y < top ? top : bottom
    return Math.hypot(x - cx, y - end) <= half
  }

  const forkX = centre - gap
  const tineTop = stemTop
  const tineBottom = centre - unit * 0.10
  const tineHalf = unit * 0.05
  const tineSpacing = unit * 0.14

  const fork = (x, y) => {
    // Handle, plus the block the tines join into.
    if (bar(forkX, centre - unit * 0.16, stemBottom, stemHalf)(x, y)) return true
    for (const offset of [-tineSpacing, 0, tineSpacing]) {
      if (bar(forkX + offset, tineTop, tineBottom, tineHalf)(x, y)) return true
    }
    return false
  }

  const spoonX = centre + gap
  const bowlCy = centre - unit * 0.26
  const bowlRx = unit * 0.17
  const bowlRy = unit * 0.25

  const spoon = (x, y) => {
    if (bar(spoonX, bowlCy, stemBottom, stemHalf)(x, y)) return true
    const dx = (x - spoonX) / bowlRx
    const dy = (y - bowlCy) / bowlRy
    return dx * dx + dy * dy <= 1
  }

  const cutlery = (x, y) => fork(x, y) || spoon(x, y)

  // Sweep starts at 12 o'clock and runs clockwise for three quarters.
  const sweptPortion = (x, y) => {
    const angle = (Math.atan2(x - centre, centre - y) + Math.PI * 2) % (Math.PI * 2)
    return angle <= Math.PI * 1.5
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      blend(pixels, offset, BG, coverage(x, y, insideBackground))
      blend(pixels, offset, TRACK, coverage(x, y, (px, py) => onRing(px, py) && !sweptPortion(px, py)))
      blend(pixels, offset, RING, coverage(x, y, (px, py) => onRing(px, py) && sweptPortion(px, py)))
      blend(pixels, offset, RING, coverage(x, y, cutlery))
    }
  }

  return encodePng(size, pixels)
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f766e"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="5"/>
  <path d="M32 12a20 20 0 0 1 0 40 20 20 0 0 1-14.14-5.86" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <g fill="#ffffff">
    <rect x="23.1" y="20" width="2" height="9" rx="1"/>
    <rect x="26.7" y="20" width="2" height="9" rx="1"/>
    <rect x="30.3" y="20" width="2" height="9" rx="1"/>
    <rect x="25.6" y="27" width="2.4" height="17" rx="1.2"/>
    <ellipse cx="38.6" cy="25" rx="3.4" ry="5"/>
    <rect x="37.4" y="25" width="2.4" height="19" rx="1.2"/>
  </g>
</svg>
`

const outputs = [
  ['public/pwa-192x192.png', render(192)],
  ['public/pwa-512x512.png', render(512)],
  ['public/pwa-maskable-512x512.png', render(512, { maskable: true })],
  ['public/apple-touch-icon.png', render(180)],
  ['public/favicon.svg', FAVICON_SVG],
]

for (const [path, data] of outputs) {
  writeFileSync(path, data)
  console.log(`wrote ${path}`)
}
