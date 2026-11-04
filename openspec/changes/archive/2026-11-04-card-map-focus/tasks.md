# Tasks

## 1. Card-selection map focus (apps/web)

- [x] 1.1 Extract `pinCoordinatesFor(unit)` in `apps/web/src/lib/map/map-config.ts` from `unitsToFeatureCollection` (the unit's exact coordinates stay the single placement source for pins and focus alike) and add the `CARD_FOCUS_ZOOM` constant with an initial street-level candidate value; verify unit tests cover the helper and the constant's doc comment states its experimentally-tunable contract
- [x] 1.2 Wire the focus behavior in `MapView.svelte`: a selection-change reaction calls `flyTo({ center: pinCoordinatesFor(unit), zoom: CARD_FOCUS_ZOOM })` with same-source dedupe (no redundant flyTo for the mount-time value), the map-creation effect initializes the camera at the focused view when a unit is already selected at mount (the mobile List→Map case, untracked read mirroring the existing initial-units pattern), and the section gains `data-map-center`/`data-map-zoom` attributes updated on `moveend`; verify component tests (mocked maplibre) cover card-click selection → expected center+zoom, keyboard sr-pin activation → identical focus, selection pre-existing at mount → focused initial camera with no flyTo, and no selection → DC default initial view
- [x] 1.3 Experiment with the focus zoom in the running app across candidate values (e.g. 14.5–16.5) selecting real cards from the list; record the chosen value with a one-line rationale in `CARD_FOCUS_ZOOM`'s doc comment (tuning later stays a one-line change)
- [x] 1.4 Add a camera-focus e2e spec: desktop — click a card, assert `data-map-center` is near the unit's coordinates and `data-map-zoom` equals the focus zoom; mobile viewport — select a card on the List tab, switch to the Map tab, assert the mounted view is already focused; verify the new spec and the full dev e2e suite pass
- [x] 1.5 Confirm keyboard parity end to end (card activation and sr-pin activation focus identically) and that the axe a11y e2e stays clean with the new camera behavior; verify via the a11y e2e (extended if needed) or a recorded manual keyboard pass

## Workflow follow-up

- After all tasks complete: run code review + adversarial security review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.

## Follow-up notes (recorded 2026-11-04, out of scope for this change)

Both items surfaced during this change's verification; neither is part of its specified behavior, and neither blocks archiving.

1. **Mobile pointer path to the mount-focus flow is blocked by product geometry (pre-existing).**
   On phone width, selecting a card opens the full-screen bottom sheet, which covers the tab row; closing the sheet clears the selection, so a pointer user cannot switch to the Map tab with a selection alive — only keyboard tab activation reaches the mount-focused view (the e2e covers the keyboard path). Candidate follow-up change; the planned `pin-selection-label` change already touches the adjacent selection-persists-while-detail-open surface.

2. **Dev e2e contention headroom (pre-existing, infra-only).**
   perf.spec's 2 s "applying a filter re-renders pins fast" guard and the a11y axe scan have thin headroom under the dev suite's default parallel workers: observed 1.5–3.3 s filter-latency runs and one axe 60 s evaluate timeout under machine load, versus 518 ms and clean passes when isolated or serial. CI's `e2e:ci` matrix uses `workers: 2` against the Compose production boot — a different environment from the dev suite. Consider serial local dev e2e runs or added headroom as separate housekeeping.
