# Proposal

## Why

User bug report (walkthrough of the running app, 2026-11-03): on a maximized desktop browser the embedded map is much wider than tall — far from square — and the side-by-side card list ends up with a short visible scroll window showing only around 3 units. The search layout should use the viewport better: a square-ish map and a list window that shows meaningfully more units without scrolling.

## What Changes

- Desktop layout proportions in `apps/web/src/routes/+page.svelte`: the map pane renders closer to a square-like aspect ratio on wide viewports (today it takes `1fr` beside a fixed `minmax(22rem, 26rem)` list column, giving roughly 2:1 width:height when maximized)
- The card list's visible scroll window grows accordingly (target: comfortably more than ~3 cards visible on a maximized desktop viewport; exact count validated in a live walkthrough)
- A responsive survey and preferred-layout confirmation: verify current behavior on mobile and across window sizes (phone / narrow tablet / wide tablet / narrow laptop / maximized desktop), confirm the preferred layout for each size class with the user, and encode the confirmed set — mobile's tabbed list-first behavior stays unless the confirmed preferences change it

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-search-ui`: MODIFIED requirement "Map + card list layout" — adds the desktop-proportions scenario

## Impact

- **Code:** `apps/web` only — `+page.svelte` grid styles (and `MapView.svelte` only if the canvas needs an explicit aspect constraint); component tests that assert layout structure; e2e mobile/a11y specs only if they pin desktop dimensions
- **APIs / Dependencies:** none
- **Docs:** none expected
- **Sequencing:** independent of `first-load-pins` and `card-map-focus` (different concern in the same files); land in any order, but a fresh visual walkthrough of the result feeds `live-walkthrough-feedback`

## Non-goals

- No change to mobile behavior, pin rendering, filtering, or card content
- No responsive-breakpoint redesign beyond what the proportions fix requires
