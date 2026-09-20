# Decisions

Things that look arbitrary but are not. Each of these cost something to find out, so changing
one without reading the reason will probably reintroduce the problem.

## Open Food Facts cannot be used for free-text search from a browser

Every OFF *search* endpoint refuses cross-origin browser requests:

| Endpoint | From a browser |
|---|---|
| `cgi/search.pl` | **503**, with no CORS headers, as soon as an `Origin` header is present |
| `search.openfoodfacts.org` | 200, but sends no `access-control-allow-origin` |
| `api/v2/search` | Blocked |
| `api/v2/product/{barcode}` | **Works** — full CORS headers |

`curl` succeeds against the first two only because it sends no `Origin`. Verifying with curl
alone is misleading; test from the page.

So search uses **USDA FoodData Central** (CORS-open) and barcodes use **Open Food Facts** (best
UK coverage). A proxy would let OFF serve both, but that means running infrastructure, which the
app deliberately does not have.

## USDA carbohydrate includes fibre; UK labels do not

`Carbohydrate, by difference` (nutrient 205) is the US convention and *includes* dietary fibre.
The app follows UK labelling, where they are separate. `foodDataCentral.ts` subtracts fibre from
carbohydrate on the way in — without that, fibre is counted twice on the dashboard. Open Food
Facts already uses the EU convention and needs no adjustment.

## Chart colours are computed and validated, never eyeballed

The palette is checked against colour-blindness and normal-vision separation floors in both light
and dark mode. Two results that look like quirks:

- **Saturated fat is an ordinal step of the fat hue, and fibre of the carbs hue** — not their own
  categorical slots. Five mutually CVD-distinct hues is not achievable; the original satFat slot
  failed the normal-vision floor at ΔE 10.9. Both are genuinely "part of" their parent on a label,
  so a darker step is also the more honest encoding.
- **The status red is reserved.** Fat is itself a red, so painting a bar red when over goal made
  identity and status indistinguishable. Bars keep their hue and signal over-goal with an icon
  plus red text. Neither chart uses colour for over-goal either: the week chart uses the goal
  line (position), the month heat map a ring.

Dark mode has its own steps rather than reusing the light ones — the light values fall outside
the dark lightness band.

The heat map's bands are weighted to the top of the range (50/75/100/over) because real days
cluster between half and a little over goal; even spacing put almost every day in the same two
shades.

## Averages divide by logged days, not calendar days

Track four days of a week and the average is over those four. Dividing by seven would report
someone as eating far less than they did — under-logging is not under-eating. The UI says which
it used.

## Dates never go through `toISOString()`

A 9pm entry would file itself under tomorrow for anyone east of UTC. All date keys come from
local getters in `domain/date.ts`, and there are tests for late-evening entries and both UK DST
transitions.

## Tests must not assume a locale

CI runs en-US/UTC; laptops often do not. A test that asserted `"14 – 20 Sept 2026"` passed
locally and failed on GitHub. Formatters take an optional locale that tests pin; assertions about
*which* dates a period covers go through date-keyed links rather than rendered text. The suite is
verified across en-US, en-GB, de-DE, ja-JP and fr-FR.

## HashRouter, not BrowserRouter

GitHub Pages has no SPA rewrite, so a refresh on a path-based route 404s. URLs carry a `#`.

## The nav bar hides when the keyboard is open

iOS Safari does not shrink the layout viewport for the keyboard, so a `position: fixed` bar
floats on top of it. `hooks/useKeyboardOpen.ts` compares `window.innerHeight` against
`visualViewport` to detect it.

## The barcode decoder is lazy and not precached

Chrome on Android has a native `BarcodeDetector`; iOS Safari has none, so ZXing (~475 KB) is
dynamically imported only where it is needed, given a stable chunk name, excluded from the
service worker precache, and runtime-cached on first scan. Precaching it would make every
install pay for a feature most sessions never touch.

## Typing a barcode in is always offered

Camera permission gets declined, lenses get scratched, and a barcode on a crumpled wrapper may
simply not read. The manual field is not a fallback for errors — it is always visible.
