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

## A meal's percentages are of the DAILY target

Each meal on the day screen shows its calories and what share of the day's calorie goal that is,
and expands to the same macro bars measured the same way — breakfast's 62 g of carbs against the
260 g daily target, not against what has been eaten so far.

The alternative, a meal's share of the day's intake to date, changes meaning as the day goes on:
breakfast would read 100% at 9am and 30% by dinner without anything being eaten differently.
Using the daily target throughout means a percentage means the same thing wherever it appears on
the screen.

Collapsed by default, because the breakdown is for when a number looks wrong, not something to
scroll past four times on the way to adding lunch. An empty meal has no control at all rather
than one that expands to six zeroes.

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

## Scroll position is managed by hand

React Router does not touch scroll, and its `<ScrollRestoration>` only works with a data router —
this app uses `HashRouter`, so `ScrollManager` does it manually. Opening "Add to breakfast" from a
scrolled Progress screen was landing part-way down a food list the user had never seen.

Forward navigation always starts at the top; **Back restores that history entry's position**,
keyed on `location.key`, so returning to a long list you had worked through does not dump you at
the top of it. Scrolling is done in a layout effect so there is no visible jump.

Several screens swap their whole contents without changing route — the ingredient picker, the
Gemini assist, the quantity panel. `ScrollManager` never sees those, so they use
`useScrollTopOnChange`: they are navigations as far as the user is concerned.

## HashRouter, not BrowserRouter

GitHub Pages has no SPA rewrite, so a refresh on a path-based route 404s. URLs carry a `#`.

## The nav bar hides when the keyboard is open

iOS Safari does not shrink the layout viewport for the keyboard, so a `position: fixed` bar
floats on top of it. `hooks/useKeyboardOpen.ts` compares `window.innerHeight` against
`visualViewport` to detect it.

## The app mark is cutlery inside the progress ring

The icon was a bare three-quarter arc, which said "progress" and nothing about food — half the
app. It now holds a fork and spoon inside that arc, keeping the link to the calorie ring on the
dashboard while saying what is being tracked. The ring was thinned, since it is now a frame rather
than the whole mark.

`scripts/generate-icons.mjs` draws every raster size from shape predicates sampled 3×3 per pixel,
so there is still no SVG rasteriser or image toolchain to install. `favicon.svg` is the same mark
written by hand. Run `npm run generate-icons` after changing either, and check the 192px output —
detail that works at 512 can turn to mush small.

The floating button uses sparkles rather than a camera: it opens the whole assist, where a photo
is one of two ways in.

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

## One AI assist, offered the same way everywhere

The AI features grew one at a time and ended up inconsistent: photo only on foods, description
only on recipes, a third camera buried inside the ingredient picker, and three different labels
for the same idea. It read as several half-features.

Now there is one component, `AiAssist`, with the input and the target as separate choices:

- **Input:** photo, or description. Photo first, every time.
- **Target:** one food, or a recipe. Decided by where you started, not by a question.

The same card — "Let Gemini work it out", **Photo** then **Describe** — appears on new food and
new recipe, and the floating button opens it in photo mode (`?ai=photo`), with description one tap
away on the switch. The camera nested inside the ingredient picker is gone: the recipe-level photo
covers it, and a camera two levels deep was the thing people got lost in. Barcode scanning stays
in the picker, because it is a different capability rather than a duplicate.

## Camera and photo library are two inputs, because one cannot be both

A file input's `capture="environment"` opens the camera on iOS and Android and is **silently
ignored on desktop**, where it falls back to a file dialog. An input without it opens the photo
library. There is no single input that offers both, so the assist has two, behind two buttons —
camera first, since that is what someone standing over their lunch wants.

Where `enumerateDevices` reports no `videoinput`, the camera button is hidden rather than left to
open a file dialog identical to the button beside it: two identical-looking buttons doing the same
thing is worse than one. If the device list cannot be read at all the camera IS offered, because
hiding it from someone who has one is the worse failure.

## Nutrition from a photo is always an estimate, and always reviewed

Gemini can suggest a food's nutrition from a picture. It cannot know how a dish was cooked or how
much oil went into it, so nothing is ever saved straight from the model: the figures land in the
food editor for review, the card above them says they came from a photo, and the model is asked
for its own confidence and for whatever it could not tell — both of which are shown.

Choosing a photo does **not** send it. It used to, which left no room to say the thing that would
have made the answer right. A note box and a "Work it out" button come first, and the answer can
be re-run with more context after a disappointing one — which is the point: tested on a packet,
adding "fun size, about 18g" moved the portion from 51 g to 18 g while keeping the per-100 g
figures.

Up to four photos can go in one request, because scale is the hardest thing to judge from a single
image — a second shot showing the container or a hand is often what makes a portion estimable at
all. When there is more than one, the request says outright that they show the SAME item;
without that a second angle reads as a second food. Four is the cap: each image costs about 1,100
tokens whatever its size, so more climbs the bill without improving the answer.

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

## Recipe meal tags are a label, never a constraint

Recipes can be tagged breakfast / lunch / dinner / snack, and the recipe list filters on them.
The tag does **not** restrict which meal a recipe can be logged to — tagging something breakfast
does not stop you eating it for dinner — and the editor says so in those words, because an
interface that looks like a restriction will be read as one.

There is deliberately no filter in the add-to-meal flow; the existing search is enough there, and
a filter would imply exactly the restriction that does not exist.

No migration came with this. The field is optional, so recipes made before tagging read as
`undefined` — untagged, which is the correct state. A migration writing `meals: []` would change
nothing except the stored bytes.

## Filter rows scroll sideways rather than wrapping

A dozen food categories wrap to four lines and push the list itself off a phone screen. One
sideways-scrolling row stays one line tall whatever the number of options, and bleeds past the
screen edges so it reads as scrollable rather than clipped. `FilterChips` is shared by Foods and
Recipes so the two behave identically.

Two details that matter on the Foods row: the categories offered are those actually in view, so
the row never lists a section that would come back empty; and a category the search has since
filtered away falls back to All, derived rather than corrected with `setState`, so no render ever
shows the wrong thing first.

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

## Removing a logged entry takes two taps

The × on a meal row sat a thumb-width from the row itself, and one stray tap cost the entry and
the search that found it. The row now arms on the first tap — the × becomes "Remove?" — and only
the second tap deletes. It disarms itself after four seconds, and arming one row disarms any
other, so a live destructive control is never left sitting there.

Two taps rather than a swipe because a swipe is invisible until you discover it, and a hidden
gesture is a poor home for the only destructive action on the screen. Two taps rather than an
undo toast because undo has to reinstate the entry under its original id to keep the day's totals
honest, and that is more machinery than the problem needs.

The Remove button on the edit-entry screen is unchanged: you got there deliberately, through two
navigations, so a second confirmation would only be in the way.

## The backup reminder is a banner, not a notification

A scheduled notification cannot be done here. The API that would have done it locally,
Notification Triggers (`TimestampTrigger`), never shipped anywhere and is not even in the compat
database. Web Push works on iOS 16.4+ for an installed web app, but Web Push means a server
holding a subscription and pushing on a timer, which is the infrastructure this app does not
have. Periodic Background Sync, which could have woken the service worker, is Chromium-only.

So the reminder appears on Today when the app is opened, and nowhere else. The honest limit is
stated in Settings rather than hidden: nothing can reach you while the app is closed.

The clock runs from the last backup, or — before there has ever been one — from the oldest day
with data in it. Measuring from the first install would nag someone who has logged nothing, and
measuring from today would never nag at all. Starter foods do not count as data: they come back
on their own.

"Later" snoozes by a full fifteen days rather than a day or two, because a reminder that returns
tomorrow is a reminder you learn to swat. "Never remind me" is a real off switch, and the only
way back is the checkbox in Settings, where someone looking for it would look.

Importing a backup sets `lastBackupAt` to the moment of import. The file just read IS a backup of
exactly that state, so a freshly restored device should not open to a reminder that its data is
at risk.

## Themes are a fixed set, and the data palette is not part of them

Four themes (Teal, Forest, Rose, Steel) and three modes (System, Light, Dark). No colour
picker: every combination here has been through `themes.test.ts`, and a free choice cannot be.

**A theme changes the chrome and the accent, never the macro hues.** A carbohydrate bar that
changed colour with the chrome would stop being a carbohydrate bar. The calorie ring and the
month heat map DO follow the accent, because each is its own single-series chart and never
appears beside the macro bars as a fifth slot — but the checker still requires the ring to sit at
least ΔE 12 from every macro hue, so it cannot be read as one of them. That floor is what moved
Steel's ring down to almost no chroma: at ΔE 7 from the protein blue it was too close.

`themes.css` holds every value in a flat block, and `themes.test.ts` reads that file. The two
cannot disagree, because there is only one copy of the numbers. Each theme declares `--l-*` and
`--d-*` tokens; the mapping rules at the bottom of the file pick a set and hold no colours of
their own, so a new theme is one block and one line in `domain/themes.ts`.

The mapping resolves on `[data-theme]`, not only on `:root`. That is what lets a swatch in
Settings paint itself in the theme it is offering, in whichever mode is live, instead of being a
hand-drawn picture of it that can drift.

### What the checker found

Numbers beat intentions. Writing it turned up four real defects in colours that had been shipping:

- **`text-brand` on a dark surface was 3.65:1**, under the 4.5:1 floor for text. The accent is now
  light in dark mode, with `--color-brand-ink` for text drawn on a brand fill. Filled buttons in
  dark mode therefore look different to before — that is the fix, not a side effect.
- **White on the dark-mode status red was 3.54:1.** `--color-over` is both a text colour on the
  surface and a fill behind text, and one value cannot do both. It gained `--color-over-ink`.
- **Four tokens were outside sRGB** far enough that the browser was throwing away more than 0.03
  of chroma — the teal ring and two of its heat steps, and the dark-mode fibre. They were written
  more vivid than any sRGB screen could ever show.
- **The light-mode status red was 4.47:1** on the lightest surface, a hair under the floor.

### What the checker deliberately does NOT claim

The earlier note in this file said the categorical macro hues clear the colour-blindness floors.
Measured with CIEDE2000 over Machado severity-1.0 simulation, **protein and salt are not
separable under red-green CVD** — ΔE 4.8 for protanopia, 2.4 for deuteranopia. Blue and purple
are genuinely hard to tell apart for those eyes. The floor in the test covers carbs, protein and
fat and excludes salt by name, rather than being lowered until everything passes.

The practical mitigation is the one that was always there: every bar carries its name and its
number, so colour is reinforcement and never the only encoding. Fixing it properly means giving
salt a different hue, which is a separate change.

## The tour is versioned by itself, not by the app

The ask was to show the tour on a first run "or when a new version of the app is released". Taken
literally that means re-running a five-card walkthrough after every deploy, and this app deploys
several times a day — a punishment for keeping it up to date.

So `TOUR_REVISION` in `domain/tour.ts` is bumped by hand, only when a card is added or rewritten,
and each card carries the revision it arrived in. A device stores the revision it has been shown.
On a first run every card is new; after an update only the cards newer than what that device has
seen appear, headed "What's new" rather than "Welcome"; and when nothing is newer, nothing
appears. A rewrite that affects nobody costs nobody anything.

Each card drives the router to the screen it is about and cuts a hole in the dimming over the
control it is describing, so "the Gemini key is in Settings" is the actual box with a ring round
it. Skip is on every card, Escape closes it, and Settings → App can bring it back.

Pointing at things is mostly a problem of pointing at things that are not there. The anchor is
missing while the route is still changing, and stays missing if a layout drops it, so
`useSpotlight` returns null in both cases and the card falls back to the plain centred sheet —
the worst outcome is the tour as it was before it could point. `Tour.anchors.test.tsx` renders
each page and fails if its `data-tour` attribute has gone, which is the only thing tying a step
to the element it names.

Three details that are not obvious:

- **The position is measured every animation frame**, not on a list of scroll and resize events.
  The target moves for too many reasons — the page scrolls, a card above it expands, the keyboard
  opens, the route is still settling — and one rule covers all of them. A `getBoundingClientRect`
  per frame costs nothing next to being subtly wrong.
- **The ring is positioned by writing to its style, not by re-rendering.** Going through React
  state meant the ring was drawn from the PREVIOUS frame's numbers, so it visibly lagged the page
  during a scroll and the border sat off the thing it was supposed to be round. Only two coarse
  facts — whether there is anything to point at, and which side the card goes — go through state,
  and only when they change.
- **The scroll is re-issued, not fired once.** `ScrollManager` sends every new route to the top,
  and that can land after the tour's own scroll and undo it. The hook keeps nudging until the
  target is near the middle, at most six times, and gives up the moment the reader scrolls for
  themselves.
- **The card is always along the bottom.** It used to take whichever side of the hole had more
  room, which meant Back and Next moved to the top of the screen for some cards and the bottom
  for others — the one part of the tour the reader has to find every single time. Now the card
  stays put and the TARGET moves instead: it is scrolled into the band above the card rather than
  into the middle of the window.

  The exception is a target that is itself pinned to the bottom, which is the floating assist
  button. No scroll can move that out from under a bottom sheet, so for that one card the sheet
  lifts just far enough to clear it — tens of pixels, not a jump across the screen.

**Anchors are controls, not cards.** Pointing at a whole settings section meant a ring taller
than a phone screen, with its edges off both ends — a hole that framed nothing. The anchors are
now the key input, the calorie box, the one button. Keys got a card each for the same reason: one
highlight over both boxes was most of the screen.

**The cards are short on purpose.** Every card is two or three sentences and the whole thing is
capped at just over half the viewport height, because a tour card that fills a phone screen is a
wall of text in front of the thing it is pointing at. If a card needs a list, it is really two
cards.

The first card leads with the iPhone storage trap rather than burying it: a home-screen web app
gets its own storage, so anything logged in Safari first is invisible to it. Finding that out
after a fortnight of logging is how people lose their data.

## Suggested targets are guarded in code, not in the prompt

Describing yourself on the Targets screen asks Gemini for a set of daily numbers, which land in
the existing boxes for review. Typing them in by hand is unchanged and still the normal way; the
suggestion block is collapsed until asked for so the form is not pushed down the page for people
who will never use it.

**The safety floors are enforced after the reply, in `toGoalsEstimate`.** A prompt that says
"never suggest below 1200 kcal" is a request, and a model that ignored it would otherwise hand
someone a 900 kcal target with the app's apparent blessing. Anything under 1200 or over 5000
kcal, or with a macro at zero, is rejected outright and the user is told nothing sensible could
be worked out — rather than being shown a number that is merely flagged. Saturated fat is clamped
to total fat the same way a food estimate is.

There is no "use these figures" button. The fields are directly below, still editable, and
nothing is written until Save is pressed, so a confirmation step would only have been a second
tap. The screen says plainly that this is a starting point and not medical advice.

This is deliberately NOT part of `AiAssist`. That component is the one way to get nutrition for a
FOOD out of Gemini and is built around photo-first input with two targets; this fills a settings
form from words alone. What is worth sharing is shared — the estimator lives beside the others in
`services/gemini.ts`, and both use `geminiErrorMessage` so a rate limit reads the same wherever
it happens.

### 401 used to send you looking in the wrong place

Testing this against a key that turned out to be an OAuth token rather than an API key produced
`401 ACCESS_TOKEN_TYPE_UNSUPPORTED`, and the code only special-cased 400 and 403 — so the user
saw "Gemini returned an error", which says nothing about what to do. 401 now joins them, and the
message names what a real key looks like.
