# Decisions

Things that look arbitrary but are not. Each of these cost something to find out, so changing
one without reading the reason will probably reintroduce the problem.

## Search queries two databases, because neither alone is enough

| Source | Good at | Weak at | Reliability |
|---|---|---|---|
| Open Food Facts | UK supermarket brands (Hovis, Warburtons), barcodes | prepared dishes, generic ingredients | flaky — see below |
| USDA FoodData Central | generic ingredients, cooked dishes (FNDDS) | UK brands (almost none) | reliable, needs a key |

They are queried **in parallel** and the results merged, branded first. If one fails the other
still answers, and the UI says the list may be short — a failure shortens the results rather
than emptying them.

### Open Food Facts search needs app identification, and is still flaky

An earlier version of this file claimed OFF search was CORS-blocked from browsers. **That was
wrong.** What actually happens:

- `cgi/search.pl` works from a browser, but is throttled hard.
- Measured success rate over repeated calls: **~1 in 3 unidentified, ~2 in 3** when the request
  carries `app_name` / `app_version` / `app_uuid`. A browser cannot set `User-Agent`, and these
  query parameters are OFF's documented substitute.
- Failures present as `TypeError: Failed to fetch`, which is indistinguishable from a CORS
  rejection — which is how the wrong conclusion got drawn in the first place.

Hence: app identification on every call, one retry, and a second source as backup.

**Testing this with `curl` alone is misleading.** `curl` sends no `Origin`, and the endpoint
behaves differently with one. A single request proves nothing either way — the behaviour is
probabilistic, so test from the page and repeat it.

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

## The API key is not in the backup export

`buildBackup` strips `meta.fdcApiKey`. A backup is a file people email to themselves and leave in
cloud storage, which is the wrong home for a credential — and `parseBackup` ignores the field on
the way in regardless, so carrying it would be a leak that buys nothing. The key is stored per
origin in `localStorage`, so it has to be entered once on localhost and once on the deployed
site.

## Nutrition from a photo is always an estimate, and always reviewed

Gemini can suggest a food's nutrition from a picture. It cannot know how a dish was cooked or how
much oil went into it, so nothing is ever saved straight from the model: the figures land in the
food editor for review, the card above them says they came from a photo, and the model is asked
for its own confidence and for whatever it could not tell — both of which are shown.

Other choices worth keeping:

- **The image is downscaled to 1024px and re-encoded as JPEG** before sending. Tokens are charged
  by image size and nothing in a nutrition estimate needs a full phone photo.
- **The default model is the `-latest` alias, not a pinned version.** A pinned
  `gemini-2.5-flash-lite` was rejected with *"no longer available to new users"* on the first real
  call, weeks after being current. Google retires names faster than a hard-coded default survives,
  and `gemini-flash-lite-latest` always resolves to the cheapest lite model of the day. It stays
  configurable, and a 404 names the offending model so a future breakage explains itself.
- **`responseMimeType: application/json` and temperature 0**, and the parser still copes with a
  markdown fence and surrounding prose, because models add them anyway.
- Saturated fat above total fat is clamped, as with the other sources.

## A described recipe reuses library foods where it can

"28g coffee beans in a moka pot + 200g whole milk, serves 2" becomes a recipe. Before creating
anything, each ingredient name is matched against the food library — a described "whole milk"
should use the curated starter food, whose figures are known, rather than add a near-duplicate
carrying a model's guess. The review screen says which were matched and which are new, because
that is the difference between a trusted figure and an estimated one.

`domain/matchFood.ts` is deliberately conservative: a wrong match silently logs the wrong food,
which is worse than a duplicate the user can see. Every word of one name must appear in the
other, so "milk" matches "Whole milk" but not "Milk chocolate", and "coffee" does not match
"coffee cake".

## The Gemini key lives on the device, which is a real trade-off

The API is called straight from the browser, which Google's CORS headers allow and which keeps
the app a static site. The cost is that the key sits in `localStorage`: anyone with the device can
read it, and it is not a secret in any meaningful sense.

That is acceptable for a personal app and not acceptable for a shared one. The settings page says
so plainly and tells the user to create a key only for this and cap its spending. Moving the call
behind a proxy would fix it and would mean running infrastructure, which this app deliberately
does not have. Like the FoodData Central key, it is stripped from backups.

## Settings is split by what the setting is about

Targets (what you are aiming for) and App (how the app behaves: search key, backups, reset) are
different jobs done at different times. They are two routes under `/settings`, with `/settings`
redirecting to the targets tab.

## Amounts are entered by count when the food has a portion

Logging "2" against a food measured in eggs meant two GRAMS, because the quantity box was grams
only. So the quantity panel defaults to counting portions whenever the food has one, with a switch
to weight — and switching units never changes how much food is being logged, only how it is
written.

Grams remain what gets STORED, in the log and in recipe ingredients alike. A portion is a
data-entry convenience, so correcting a food's portion size later cannot silently rewrite
everything ever logged with it.

## Typing a barcode in is always offered

Camera permission gets declined, lenses get scratched, and a barcode on a crumpled wrapper may
simply not read. The manual field is not a fallback for errors — it is always visible.
