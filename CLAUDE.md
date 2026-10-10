# Health App — orientation for agents

A personal meal and macro tracker. Static React PWA, no backend, no auth, no build-time
secrets. Data lives in the browser's `localStorage`. Deployed to GitHub Pages on every push
to `main`.

**Read this file first, then `docs/ARCHITECTURE.md` for the data model and layer rules, and
`docs/DECISIONS.md` for why things are the way they are.** Between them they should save you
reading the source to find your bearings.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run test       # watch
npm run test:run   # single run — 300+ unit tests
npm run build      # tsc -b && vite build
npm run preview    # production build with the service worker live
npm run lint       # oxlint (warnings only; zero errors expected)
```

## Layout

```
src/
  domain/      pure maths — nutrition, dates, food search filters. No React, no storage, no fetch.
  storage/     the ONLY module that touches localStorage, plus the bundled starter foods
  services/    outside world: Open Food Facts + USDA FoodData Central (fanned out by
               foodSearch.ts), and Gemini for photo estimates
  state/       reducer, selectors, store provider, toast provider, backup import/export
  hooks/       cross-cutting browser behaviour (keyboard, service-worker updates, lookups)
  components/  shared UI, including the hand-rolled charts
  pages/       one file per screen, wired up in App.tsx
```

## The things most likely to trip you up

1. **Log entries store a snapshot of their nutrition, not a reference.** Editing or deleting a
   food must never change meals already logged. There are tests that enforce this.
2. **Dates are local calendar dates**, never `toISOString()`. Weeks run Monday to Sunday.
   `src/domain/date.ts` is the only place that should do date arithmetic.
3. **Carbohydrate excludes fibre** (UK label convention). USDA reports it the US way, with fibre
   included, so `services/foodDataCentral.ts` subtracts it on the way in. Open Food Facts already
   matches our convention.
4. **Bump `SCHEMA_VERSION` and write a migration whenever existing records would otherwise be
   MISREAD** — a renamed, removed, or differently-meaning field on `Nutrients`, `Food`, `Recipe`,
   `LogEntry` or `Goals`. See `storage/repository.ts` — v1→v2 added fibre, where absent had to
   become 0. A purely additive OPTIONAL field needs neither: absent already reads correctly
   (`Recipe.meals` is the example).
5. **Chart colours are validated, not chosen by eye.** Every colour lives in `src/themes.css`,
   and `src/themes.test.ts` reads that file and checks contrast, sRGB gamut and separation for
   all four themes in both modes. Change a colour there and run the tests; do not add values to
   `index.css`, which only registers the token names for Tailwind. See `docs/DECISIONS.md`.
6. **Nothing secret goes in a backup.** `buildBackup` strips both API keys; keep it
   that way if you add other credentials.
7. **An unrecorded day is not a zero day.** The food log distinguishes them, and averages divide
   by logged days only.
8. **A Gemini estimate is never saved directly.** It fills the editor for review, labelled as an
   estimate. Gemini cannot know how something was cooked.
9. **There is one AI entry point, not several.** `AiAssist` takes the input (photo / describe) and
   the target (food / recipe) as separate props, so every screen offers the same two options in
   the same order. Resist adding a fourth place to do this.

## Testing

Unit tests only, by request — no e2e, no security scanning. `*.test.ts(x)` sits beside the code
it tests. Tests must pass in any locale and timezone: never assert on a formatted date string
without pinning a locale (CI runs en-US/UTC, laptops often do not).
