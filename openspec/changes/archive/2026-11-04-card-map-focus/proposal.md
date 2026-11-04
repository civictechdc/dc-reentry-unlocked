# Proposal

## Why

Today, selecting a unit card highlights its map pin but leaves the map camera wherever it happens to be — a user scanning the list often selects a card whose pin sits off-screen or at a zoom where context is unreadable. Card selection should bring the map to the unit so the two views read as one conversation about the same place.

## What Changes

- Selecting a unit card (mouse or keyboard) centers the map on that unit's pin and sets a pre-determined focus zoom level
- The focus zoom is a single map-config constant with an explicitly experimentable value — the initial value ships after in-app experimentation, and tuning it is a one-line change
- On mobile, where the map is not mounted while the List tab is active, the focused view is applied when the map next mounts (no forced tab switch — the user keeps their list context)
- Closing the detail panel does not restore the previous camera position — the map keeps the focused view (recorded as a deliberate design decision)
- Assumes the exact-addresses-only world (planned change): every unit carries exact coordinates, so focus always targets the unit's own placement

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-search-ui`: the map + card list layout requirement gains card-selection camera behavior — selecting a card focuses the map on the associated pin at a fixed zoom (desktop and mobile-mount cases, keyboard parity)

## Impact

- **Code:** `apps/web` only — `src/lib/components/MapView.svelte` (focus reaction + mount-time focused view), `src/lib/map/map-config.ts` (focus zoom constant + extracted pin-coordinate helper), `src/lib/components/UnitCard.svelte` (unchanged wiring — selection already flows through `uiState.selectedUnitId`), component tests (mocked maplibre asserting the camera calls), e2e (camera-moved assertion via an observable hook)
- **APIs:** none — no contract change; entirely client-side behavior
- **Dependencies:** none
- **Docs:** none beyond the constant's in-code rationale
