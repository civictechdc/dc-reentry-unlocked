# Design

## Context

The map lives in `apps/web/src/lib/components/MapView.svelte` as a thin MapLibre wrapper with three effects: create (container-only deps), data (`store.units` → GeoJSON `setData`), and highlight (hover/selection → `setFilter`). Card selection already flows through `uiState.selectedUnitId` (`UnitCard.selectCard`) and pins are placed by `unitsToFeatureCollection` in `src/lib/map/map-config.ts` — at each unit's exact coordinates (the exact-addresses-only change, planned and sequenced before this one, removes the ward-anchor concept). The initial camera is `DC_MAP_CENTER`/`DC_MAP_ZOOM = 12.5` at map creation. On mobile (`+page.svelte`), MapView is **conditionally mounted** — unmounted while the List tab is active — so a card click there has no live map to move.

## Goals / Non-Goals

**Goals:**
- Selecting a card centers the map on the unit's pin at a fixed, experimentable focus zoom
- Focus placement always equals pin placement (single coordinate source)
- Keyboard parity; mobile List-tab selection reflected when the map next mounts

**Non-Goals:**
- No forced mobile tab switching on card selection (the user keeps their list context)
- No camera restore when the detail panel closes (the map keeps the focused view — deliberate)
- No reverse behavior change (pin→card highlight already exists; list scroll-to-card is out of scope)
- No map-camera persistence across page reloads

## Decisions

**D1 — Focus trigger: every selection change, not card-click only.** The focus reaction watches `uiState.selectedUnitId`, so card clicks, keyboard card activation, sr-pin (keyboard pin list) activation, AND canvas pin clicks all focus the map uniformly. Rationale: keyboard parity comes free, the behavior is consistent (clicking a visible pin at the city view zooms into it — standard map UX), and the implementation is one reaction instead of origin-tracking state. The spec requires the card-selection cases; pin-click focus is the uniform corollary.

**D2 — Single coordinate source.** Extract `pinCoordinatesFor(unit): [lng, lat]` from `unitsToFeatureCollection` in `map-config.ts` (the unit's exact coordinates — the pin's own placement logic). MapView's focus reaction and the map-creation initial view both use it — focus and pin can never disagree.

**D3 — `CARD_FOCUS_ZOOM` in `map-config.ts`.** One exported constant beside `DC_MAP_ZOOM`. Initial candidate ~15.5 (street level, building context readable); the task block includes a short in-app experiment across a few values (e.g. 14.5–16.5) with the chosen value and one-line rationale recorded in the constant's doc comment. Tuning later = one-line change; no config surface, no contract impact.

**D4 — Camera API: `map.flyTo({ center, zoom })`.** MapLibre's animated flyTo (default duration, speed/distance-scaled) — smooth context, the standard choice. No `jumpTo` (jarring), no custom duration constant (defaults are well-tuned; revisit only if experimentation says otherwise — record in the constant's comment if so).

**D5 — Mobile mount-time focused view.** Because MapView unmounts on the List tab, the create-effect's initial center/zoom reads the (untracked) current selection at mount: if a unit is selected, initialize at `pinCoordinatesFor(unit)` + `CARD_FOCUS_ZOOM`; otherwise the existing `DC_MAP_CENTER`/`DC_MAP_ZOOM`. This mirrors the existing untracked `initialUnits` pattern in the load handler. When the map IS mounted (desktop, or mobile Map tab), the focus reaction handles changes live — the reaction must skip the initial mount value to avoid a redundant flyTo on creation (same-source dedupe).

**D6 — E2E observability hook.** MapView's `<section>` gains `data-map-center="[lng,lat]"` / `data-map-zoom` attributes, updated on `moveend`. Cheap, always-on (also useful for debugging), and lets the e2e assert the camera moved without touching maplibre internals from Playwright.

## Risks / Trade-offs

- [flyTo during rapid re-selection] — selecting several cards quickly queues animations; MapLibre interrupts the in-flight flyTo on a new one, so the last selection wins — acceptable (no debouncing unless experimentation shows jank; record if so).
- [Focus zoom vs. dense wards] — in dense areas several pins sit close at focus zoom; the cross-highlight (distinct color + larger radius) keeps the selected pin identifiable — acceptable; revisit the zoom constant if experimentation disagrees.
- [Mobile List→Map round-trip] — a user who selects a card, switches to Map (focused view), switches back to List, and switches to Map again re-mounts focused on the still-selected unit — consistent, not surprising; selection clearing (detail close) returns the next mount to the DC default view.
- [Sequencing] — assumes the exact-addresses-only change has landed (every unit has exact coordinates); if this change is implemented first, `pinCoordinatesFor` simply returns whatever placement the pin uses at that time — the single-coordinate-source rule holds either way.
