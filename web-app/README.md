# D.C. Reentry Unlocked — Housing Program Discovery

A small Svelte 5 + TypeScript + Vite app for exploring reentry housing
programs in Washington, D.C.: filter programs by classification, housing
category, ward, eligibility and cost, and see the results stay in parity
across a Leaflet map, a table and a live count badge.

> **Synthetic data notice:** all programs are generated sample data using real
> provider names — program details, locations, costs, and vacancies are
> simulated. Discovery only — not eligibility determination or verified
> availability. Do not rely on them for any housing decision.

## Setup

```sh
npm install
```

## Scripts

| Script           | What it does                                  |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Start the Vite dev server                     |
| `npm run test`   | Run the Vitest suite once                     |
| `npm run check`  | Type-check with `svelte-check` and `tsc`      |
| `npm run build`  | Production build into `dist/`                 |
| `npm run preview`| Serve the production build locally            |

## Verification

Before considering any change done, all of the following must pass:

```sh
npm run test    # all tests green
npm run check   # zero type errors
npm run build   # build succeeds
```

## Data

- **Sample programs** are generated deterministically at startup by
  `src/lib/data/generate.ts` using a seeded Faker instance — **seed `2026`** — so
  every run produces the exact same 75 programs. Placement uses rejection
  sampling: candidates are drawn from a bounding rectangle and kept only when
  they also fall inside the D.C. boundary polygon.
- **D.C. boundary** is a simplified DC diamond polygon; synthetic data only.

## Map tiles

Map imagery and data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, served via the `tile.openstreetmap.org` tile layer.
