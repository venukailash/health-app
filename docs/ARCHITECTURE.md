# Architecture

## Layers, and what may depend on what

```
pages ──▶ components ──▶ hooks ──▶ state ──▶ storage ──▶ domain
                                     └──▶ services ──────┘
```

- **`domain/`** — pure functions. No React, no `localStorage`, no `fetch`, no `Date.now()` in
  anything that returns a value used for storage. This is where the maths lives and where test
  coverage is deepest.
- **`storage/`** — the only consumer of `localStorage` anywhere. Everything is wrapped in a
  `{ version, data }` envelope and every read degrades to a fallback rather than throwing: a
  corrupt key must never white-screen the app.
- **`services/`** — the only code that makes network calls.
- **`state/`** — a `useReducer` store. The reducer is pure; ids and timestamps are made in
  `state/factories.ts` so the reducer stays deterministic under test.

## Data model

`src/domain/types.ts` is the source of truth. The shapes:

```ts
Nutrients { kcal, fat, satFat, carbs, fibre, protein, salt }   // per 100 g for a Food
Food      { id, name, brand?, category?, barcode?, per100g, defaultServing?, source, createdAt }
Recipe    { id, name, ingredients: [{ foodId, grams }], servings, createdAt }
LogEntry  { id, date, meal, ref, label, nutrients, loggedAt }
Goals     = Nutrients                                          // daily nutrition targets
LogByDate = Record<'YYYY-MM-DD', LogEntry[]>

DayActivity   { date, steps, source: 'manual' | 'shortcut', updatedAt }
ActivityByDate = Record<'YYYY-MM-DD', DayActivity>
ActivityGoals  { steps }                                       // NOT part of Goals — see DECISIONS
```

Three invariants worth stating explicitly:

- **Foods are always per 100 g.** One conversion path, one place for rounding.
- **Unsaturated fat is derived** (`fat - satFat`), never stored, so the parts cannot disagree
  with the whole.
- **`LogEntry.nutrients` is a snapshot** taken at log time. `ref` exists only so an entry can be
  re-edited, not to look values up for display.

## Storage keys

| Key | Holds |
|---|---|
| `healthapp.foods.v1` | `Food[]` |
| `healthapp.recipes.v1` | `Recipe[]` |
| `healthapp.log.v1` | `LogByDate` |
| `healthapp.goals.v1` | `Goals` (nutrition only) |
| `healthapp.activity.v1` | `ActivityByDate` — steps per local date |
| `healthapp.activitygoals.v1` | `ActivityGoals` — the daily step target |
| `healthapp.meta.v1` | `{ seedVersion, fdcApiKey? }` |

The key names are fixed; the *schema* version lives inside the envelope. Current version: **2**.

### Adding a migration

1. Bump `SCHEMA_VERSION` in `storage/repository.ts`.
2. Extend `migrate()` to upgrade from each older version.
3. Add cases to `storage/migration.test.ts`.

Note the distinction v1→v2 had to make: a missing *measurement* migrates to `0` (unknown), but a
missing *goal* adopts the recommended default — a 0 g target would leave that bar at 0% forever.

## Starter foods

128 UK foods in `storage/seed/foods.seed.json`, imported on first run. `applySeedFoods()` both
adds new starter foods and **refreshes existing ones**, because they are read-only and that is
the only way an existing install picks up corrections. User-created foods are never touched.

Bump `seedVersion` in the JSON when the data changes.

## Outside services

Both are free, keyless-or-nearly, and CORS-open — the app stays a pure static site.

| Job | Service | Why |
|---|---|---|
| Free-text search | **Both**, in parallel | Neither covers what people type — see `docs/DECISIONS.md` |
| Branded / UK products | Open Food Facts | The only source with real UK supermarket coverage |
| Generic and cooked foods | USDA FoodData Central | Foundation, SR Legacy and FNDDS (prepared dishes) |
| Barcode lookup | Open Food Facts | Best barcode coverage; its product endpoint is reliable |

`services/foodSearch.ts` fans out to both and merges, branded first. One source failing yields
partial results, not none. Both share the rate-limit shape: a 429/403 sets a shared cooldown, the
UI raises a toast, and the next search after the cooldown simply works again.

## Charts

Hand-rolled HTML/CSS, no charting library — the two forms needed (a column chart and a calendar
grid) would not justify roughly doubling the bundle of an app whose point is loading instantly
offline. `CalorieRing` is inline SVG; `DailyColumns` and `CalendarHeatmap` are flex/grid with
CSS custom properties for theming.

## Service worker

`registerType: 'prompt'`, applied automatically by `hooks/useAppUpdate.ts`. Prompt mode is not
about asking the user — it is so the reload is ours to schedule, since an automatic one can land
mid-sentence and throw away what someone was typing. The hook also polls hourly and on
foreground, because a service worker otherwise only looks for updates on navigation and an
installed PWA can go days without one.

The barcode decoder (~475 KB) is deliberately **excluded from the precache** and runtime-cached
on first use instead.
