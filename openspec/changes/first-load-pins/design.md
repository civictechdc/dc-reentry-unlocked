# Design

## Context

`MapView.svelte` renders pins through two effects:
1. Map-create effect: constructs the map; on `map.on("load")` adds the GeoJSON
   source with `untrack(() => store.units ?? [])` as initial data, then both
   circle layers.
2. Pin-update effect: on `store.units` change, builds the feature collection
   and calls `getSource(PIN_SOURCE)?.setData(data)` — but ONLY inside
   `if (map?.isStyleLoaded())`.

A related, already-documented defect in the same lifecycle family: the
highlight effect calls `setFilter("units-pins-highlight", …)` guarded by
`isStyleLoaded()`, which can return true BEFORE the `load` handler attaches
the layer — producing a console error (routed to `card-map-focus` by the
exact-addresses-only final review).

## Suspected mechanism (unconfirmed — investigation task decides)

The pin-update effect's guard is a silent no-op in the window where
`isStyleLoaded()` is true but the source is not yet attached (the same
isStyleLoaded-before-load quirk), OR where the style reports loaded but the
`load` event is delayed. Static reading suggests the load handler's
current-units read should cover both fetch-before-load and fetch-after-load
interleavings — so the observed failure needs empirical reproduction to
isolate (candidates include: a no-op setData path with no later replay; a
slow style with fast units fetch under dev-server conditions; an exception
path inside the load handler aborting layer attachment; an isStyleLoaded
state machine edge under raster styles).

## Decisions

**D1 — Investigation before fix.** Reproduce with controlled interleavings
(mock maplibre event ordering; dev stack with throttled style), instrument,
and identify the actual interleaving before changing the guard. No
speculative rewrite.

**D2 — Fix shape (contingent on D1): the data effect must not be
silently droppable.** Whatever the root cause, the invariant is "latest
store.units always reaches the source once the source exists" — e.g., a
replay of the latest data when the source/layer becomes available (load
handler reads current units AND the update effect re-applies on source
availability), or replacing the isStyleLoaded guard with a
source-existence check. The chosen fix must make the no-op window
impossible, not narrower.

**D3 — Deterministic pin test.** The component test controls mock-maplibre
event order explicitly: (a) units resolve before load, (b) units resolve
after load, (c) units resolve in the quirk window (style-loaded flag true,
load not yet fired) — all three must end with the source holding every
unit. Mutation-calibrate: break the fix (restore the old guard), confirm
case (c) fails.

**D4 — Fold the setFilter guard fix here if convenient.** If the
investigation touches the same guard pattern, land the
`getLayer`-existence guard for the highlight effect in the same change
(it is otherwise routed to card-map-focus); otherwise leave it there.

## Risks / Trade-offs

- [Intermittency] The bug is timing-dependent; if reproduction fails, the
  fix proceeds on the invariant (D2) with the investigation documented —
  an unfalsifiable wait is worse than an invariant hardening.
- [card-map-focus overlap] Both changes touch MapView's lifecycle; landing
  this first (sequencing in the proposal) avoids a rebase of focus work.
