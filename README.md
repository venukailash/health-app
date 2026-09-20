# Health App

A personal meal and macro tracker: log what you eat, build reusable recipes, and see how the day
is tracking against your calorie and macronutrient goals.

Everything runs in the browser. There is no server, no database and no account — your data lives
in `localStorage` on the device you use, and the app works offline once loaded.

## What it does

- **Day** — a calorie ring plus a bar per macro showing grams consumed, your target and the
  percentage of goal. Fat is broken down into saturated and unsaturated. Entries are grouped into
  breakfast, lunch, dinner and snacks, with a subtotal each, and you can step back and forward
  through days.
- **Week** — calories per day as columns against a goal reference line, your average day as macro
  bars, and a day-by-day list. Averages are over the days you actually logged, not all seven.
- **Month** — a calendar heat map shaded by how much of your calorie goal you ate, with days over
  goal ringed, plus the same averages and an optional table of every logged day.
- **Foods** — a searchable library, pre-loaded with 128 common UK foods. Add your own from the
  per-100 g column of a label, with an optional typical portion. Starter foods are read-only but
  can be duplicated and edited.
- **Recipes** — combine foods by weight, set how many servings it makes, and see per-serving and
  whole-recipe nutrition update as you build. Log a recipe by the serving.
- **Activity** — daily step count against a target, with weekly and monthly averages. Steps come
  from Apple Health via an iOS Shortcut that copies them to the clipboard, or by hand. (A PWA
  cannot read HealthKit, and an installed iOS app has its own storage that a link cannot reach —
  hence the clipboard.)
- **Settings** — split in two: **Targets** for what you are aiming at each day, **App** for the
  search API key, backups and resetting.

Tracked so far: calories, carbohydrate, protein, fat (with saturates), and salt in grams.

## Running it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm run test           # unit tests, watch mode
npm run test:run       # unit tests, single run
npm run coverage       # coverage for the domain, storage and state layers
npm run build          # type-check and build to dist/
npm run preview        # serve the production build, service worker active
npm run lint
npm run generate-icons # redraw the PWA icons from scripts/generate-icons.mjs
```

## How it is put together

```
src/
  domain/     pure nutrition and date maths — no React, no storage
  storage/    the only code that touches localStorage, plus the seed food data
  state/      reducer, selectors, store provider, backup import/export
  components/ shared UI, including the hand-rolled charts
  pages/      one file per screen
```

Charts are hand-rolled HTML and CSS rather than a charting library: the two forms needed here are
a column chart and a calendar grid, and a library would have roughly doubled the bundle of an
app whose whole point is loading instantly offline on a phone.

Three decisions worth knowing about:

- **Foods are stored per 100 g.** One conversion path, one place for rounding. Unsaturated fat is
  derived (`fat - satFat`) rather than stored, so the parts can never disagree with the whole.
- **Log entries hold a snapshot of their nutrition.** Correcting or deleting a food does not
  rewrite meals you have already logged.
- **Dates are local calendar dates**, never derived from `toISOString()` — otherwise a 9pm entry
  would file itself under tomorrow for anyone east of UTC. Weeks run Monday to Sunday.
- **Weekly and monthly averages divide by logged days, not calendar days.** Averaging four
  tracked days across a whole week would quietly report you as eating far less than you did.

### Chart colours

The macro palette is checked with a validator rather than by eye, in both light and dark mode:
the categorical slots have to clear colour-blindness and normal-vision separation floors, and the
heat-map ramp has to be a single hue with monotone lightness whose lightest step still stands off
the surface. Two consequences worth knowing:

- Saturated fat is a **darker step of the fat hue**, not a fifth category — as a part of fat it
  was always going to sit too close to it to be a rival slot.
- The status red is **reserved**. A macro bar keeps its own hue when it goes over goal and says so
  with an icon and red text instead, so identity and status never share a channel. Neither chart
  uses colour for "over goal" either: the week chart uses the goal line, the heat map a ring.

## Deploying to GitHub Pages

The repository ships `.github/workflows/deploy.yml`, which tests, builds and publishes on every
push to `main`. One-time setup:

1. Create the GitHub repository and push `main`.
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. The first run publishes to `https://<your-username>.github.io/health-app/`.

The build sets its base path from `GITHUB_ACTIONS`, so local dev stays at `/` while the deployed
build is served from `/health-app/`. If you name the repository something else, change `base` in
`vite.config.ts` to match.

Routing uses `HashRouter` deliberately: GitHub Pages has no SPA rewrite, so a refresh on a
path-based route would 404.

## Installing it as an app

Open the deployed URL on your phone and choose **Add to Home Screen** (Share menu on iOS Safari,
the menu on Android Chrome). It then launches full-screen and works offline.

## Your data

Nothing leaves the device. That also means clearing your browser data deletes it, and each
browser or device has its own copy — use **Settings → Export backup** before clearing, or to move
between devices.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — orientation for agents and new contributors
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, data model, storage and migrations
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why things are the way they are
