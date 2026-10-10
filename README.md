# D.C. Reentry Unlocked — Housing Finder

A small Svelte 5 + TypeScript + Vite app for exploring housing options in
Washington, D.C.: filter houses by price, bedrooms and property type, and see
the results stay in parity across a Leaflet map, a sortable table and a live
count badge.

> **Synthetic data notice:** all listings are generated sample data — not real
> listings. Do not rely on them for any housing decision.

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

- **Sample houses** are generated deterministically at startup by
  `src/lib/data/generate.ts` using a seeded Faker instance — **seed `42`** — so
  every run produces the exact same 75 houses. Placement uses rejection
  sampling: candidates are drawn from a bounding rectangle and kept only when
  they also fall inside the D.C. boundary polygon.
- **D.C. boundary** is a simplified DC diamond polygon; synthetic data only.

## Map tiles

Map imagery and data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, served via the `tile.openstreetmap.org` tile layer.
