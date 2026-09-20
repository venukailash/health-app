# Health App

A personal meal and macro tracker: log what you eat, build reusable recipes, and see how the day
is tracking against your calorie and macronutrient goals.

Everything runs in the browser. There is no server, no database and no account — your data lives
in `localStorage` on the device you use, and the app works offline once loaded.

## What it does

- **Today** — a calorie ring plus a bar per macro showing grams consumed, your target and the
  percentage of goal. Fat is broken down into saturated and unsaturated. Entries are grouped into
  breakfast, lunch, dinner and snacks, with a subtotal each, and you can step back and forward
  through days.
- **Foods** — a searchable library, pre-loaded with 128 common UK foods. Add your own from the
  per-100 g column of a label, with an optional typical portion. Starter foods are read-only but
  can be duplicated and edited.
- **Recipes** — combine foods by weight, set how many servings it makes, and see per-serving and
  whole-recipe nutrition update as you build. Log a recipe by the serving.
- **Settings** — set your daily targets, export a JSON backup, import one back, or reset.

Tracked in this first slice: calories, carbohydrate, protein, fat (with saturates), and salt in
grams. Weekly and monthly views are next; the log is already stored per calendar day so they are
additive.

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
  components/ shared UI
  pages/      one file per screen
```

Three decisions worth knowing about:

- **Foods are stored per 100 g.** One conversion path, one place for rounding. Unsaturated fat is
  derived (`fat - satFat`) rather than stored, so the parts can never disagree with the whole.
- **Log entries hold a snapshot of their nutrition.** Correcting or deleting a food does not
  rewrite meals you have already logged.
- **Dates are local calendar dates**, never derived from `toISOString()` — otherwise a 9pm entry
  would file itself under tomorrow for anyone east of UTC.

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
