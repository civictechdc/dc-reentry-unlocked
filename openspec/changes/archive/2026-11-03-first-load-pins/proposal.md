# Proposal

## Why

User bug report (walkthrough of the running app, 2026-11-03): sometimes on first load the map shows no location pins until a filter option is chosen; the card list shows units while the map stays empty. The requirement is unambiguous: with no filters set, ALL location pins appear on first load, matching the full list of available units. The report is confirmed-by-observation; the mechanism is NOT yet confirmed — this change investigates, then fixes and pins.

## What Changes

- Investigate and fix the first-load pin rendering in `apps/web/src/lib/components/MapView.svelte` so the unfiltered first load deterministically renders every available unit's pin
- Add the requirement to the map spec: no filters set → every available unit's pin renders on first load, consistent with the card list
- Pin the fix with a deterministic component test that controls the load/data interleaving (the mock maplibre already exists in `MapView.test.ts`)

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-search-ui`: MODIFIED requirement "Map + card list layout" — adds the unfiltered-first-load completeness scenario

## Impact

- **Code:** `apps/web` only — `MapView.svelte` (lifecycle of the pin-update effect), `MapView.test.ts` (interleaving-controlled test)
- **APIs / Dependencies:** none
- **Docs:** none expected
- **Sequencing:** fix BEFORE or TOGETHER WITH `card-map-focus` — both rewrite MapView's reactive lifecycle (card-map-focus adds camera focus on selection; its planning already carries the related `setFilter`-before-layer guard follow-up from the exact-addresses-only final review). Landing this fix first gives card-map-focus a sound lifecycle to build on.

## Non-goals

- No change to pin styling, filtering semantics, or the card list itself
- No speculative rewrite of MapView beyond what the root cause requires
