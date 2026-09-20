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
  services/    outside world: USDA FoodData Central (search), Open Food Facts (barcodes)
  state/       reducer, selectors, store provider, toast provider, backup import/export
  hooks/       cross-cutting browser behaviour (keyboard, service-worker updates, lookups)
  components/  shared UI, including the hand-rolled charts
  pages/       one file per screen, wired up in App.tsx
```

## The five things most likely to trip you up

1. **Log entries store a snapshot of their nutrition, not a reference.** Editing or deleting a
   food must never change meals already logged. There are tests that enforce this.
2. **Dates are local calendar dates**, never `toISOString()`. Weeks run Monday to Sunday.
   `src/domain/date.ts` is the only place that should do date arithmetic.
3. **Carbohydrate excludes fibre** (UK label convention). USDA reports it the US way, with fibre
   included, so `services/foodDataCentral.ts` subtracts it on the way in. Open Food Facts already
   matches our convention.
4. **Bump `SCHEMA_VERSION` and write a migration** for any change to `Nutrients`, `Food`,
   `Recipe`, `LogEntry` or `Goals`. See `storage/repository.ts` — v1→v2 added fibre.
5. **Chart colours are validated, not chosen by eye.** See `docs/DECISIONS.md` before touching
   any `--color-*` token.

## Testing

Unit tests only, by request — no e2e, no security scanning. `*.test.ts(x)` sits beside the code
it tests. Tests must pass in any locale and timezone: never assert on a formatted date string
without pinning a locale (CI runs en-US/UTC, laptops often do not).
