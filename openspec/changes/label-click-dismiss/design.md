# Design

## Context

MapView carries one shared identity (`hoveredCardUnitId ??
hoveredPinUnitId ?? selectedUnitId`) driving the highlight and label
filters. Pin clicks set `hoveredPinUnitId` + `selectedUnitId`; card
interactions set only their own id, so a pin-clicked id survives later card
selections (stale-precedence bug). The only dismissal paths today are the
detail's close control and blur/hover-off. MapLibre emits both layer-scoped
and map-wide `click` events; drag-panning interaction with `click` needs
doc verification.

## Decisions

**D1 — Map-wide click handler with a no-pin-hit guard.** One
`map.on("click", ...)` handler: query the pin layer at the click point
(`queryRenderedFeatures(point, { layers: [base] })` — exact shape verified
against docs before implementation); only when NO pin feature is hit, clear
all three identity ids exactly like the detail-close path does. Pin clicks
keep working through the existing layer-scoped handler (a pin hit skips the
clear), so no propagation games between the two handlers.

**D2 — Drag discrimination via MapLibre's own click semantics.** The
handler must never fire from a pan. Verify against maplibre-gl 6.16 docs
whether `click` is already suppressed after drag-pan/drag events; if the
suppression is not guaranteed across mouse + touch, add explicit
`dragstart`/`dragend` (or `movestart` with origin tracking) guarding. The
e2e suite proves both directions with real gestures (click-off dismisses;
drag-pan does not).

**D3 — Stale pin-hover cleared on new selection.** Whenever a selection
lands on a unit through a NON-pin path (card click, keyboard card
activation, keyboard pin-button activation), clear `hoveredPinUnitId` —
the canvas pin click path keeps setting both, since its hover id matches
its selection. Implement at the selection call sites in MapView and the
card list rather than inside uiState, keeping the store dumb.

**D4 — Detail closes through the existing mechanism.** The slide-over
renders from `selectedUnitId`; clearing it (click-off or close control)
closes the panel. No new close plumbing.

## Risks / Trade-offs

- [Map-wide click vs layer clicks] Both handlers can observe one physical
  click; the no-pin-hit guard is the single discriminator — covered by a
  jsdom test where a pin hit must NOT clear.
- [Touch tap-vs-drag thresholds] MapLibre's internal threshold decides;
  if docs leave it ambiguous, the e2e tap-drag test is the arbiter and the
  guard from D2 becomes mandatory.
- [Spec sync] Both modified requirements live in `housing-search-ui`,
  which active `map-aspect-ratio` also touches — re-run
  `openspec validate --all --strict` at archive and sync before it lands
  the same way pin-selection-label did.
