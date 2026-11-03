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

## Confirmed mechanism (investigated — repro tests + live instrumented run)

Verified against the installed `maplibre-gl` 6.16.0 dist and reproduced in
`apps/web/src/lib/components/MapView.test.ts` (describe block "first-load
interleavings (regression pins)" — named "(diagnosis)" during the
investigation, renamed when the repro flipped to a regression pin) plus an
instrumented Playwright run against the dev stack (2026-11-03).

The real maplibre facts (dist source):

- `Map.loaded()` returns `!this._styleDirty && !this._sourcesDirty &&
  !!this.style && this.style.loaded()`, and the `load` event fires inside
  `_render()` only when `Map.loaded()` is true. So on a first load, `load`
  can never dispatch while `isStyleLoaded()` (= `style.loaded()`) is false —
  the suspected "load fired while the style reports not-loaded" ordering is
  impossible.
- `Style.loaded()` returns false while `_updatedSources` has pending entries
  or any `TileManager` is unloaded. `Style.addSource` creates a fresh,
  not-yet-loaded TileManager, and `Style.addLayer` on a non-raster source
  sets `_updatedSources[source] = "reload"` and pauses its tile manager.

Therefore the actual drop window is created by the load handler itself:
the moment it runs `addSource(PIN_SOURCE)` + the two `addLayer` calls,
`isStyleLoaded()` flips back to FALSE and stays false until the added
GeoJSON source settles (worker roundtrip) and the style's dirty state
drains — and it re-dips again while post-load raster tiles settle. Any
`store.units` change landing in such a stretch hits the pin-update effect's
guard, silently no-ops (optional-chained `setData`), and is never replayed.
The source keeps the data the load handler attached — empty, because on
first load the page fires `store.initialize()` without waiting (mount is
not gated on readiness), so `store.units` is `null` while the style loads.
A later `store.units` change — the user choosing a filter — re-runs the
effect once the style reports loaded, and `setData` finally renders pins:
exactly the reported "no pins until a filter option is chosen". The bug is
intermittent because it needs the units fetch to resolve inside one of the
false stretches (a few frames wide on a warm stack, longer while tiles
settle).

Evidence per interleaving:

- (a) units resolve BEFORE `load`: not the bug — the load handler reads the
  current `store.units` (`untrack` reads the live value), so the initial
  attach carries them. Test: "units resolving before load still pin every
  unit once load fires (the load handler reads the latest units)"; live
  throttled-style run (tiles held 2 s) showed 367 pins rendered.
- (b) units resolve after the source settled: not the bug — the guard
  passes and `setData` applies. Test: "units resolving after the source
  settled re-render every pin through the update path"; live runs landing
  units ≥ 65 ms after `load` all logged `setData features=932` with
  `isStyleLoaded=true`.
- (c) the style-loaded-before-load frame: exists (≤ one render frame) but
  self-heals through the load handler's current-units read. Test: "units
  resolving while the style reports loaded but load has not fired still
  pin every unit".
- (d) THE BUG: units resolve inside a false stretch after the source
  attached. During the investigation this was a failing-state repro carried
  as `test.fails`; since the fix landed it is the regression pin
  "units resolving in the style-reloading window after the source attaches
  land in the source while the style reports not-loaded" — it asserts that
  the units arriving in the window reach the source (`setDataCount` of 1,
  every unit pinned), which fails under the old guard. Companion pin:
  "units arriving in the style-reloading window and the next result-set
  change both reach the source" (the observed filter-choice recovery, now
  asserting the fixed outcome instead of the drop). Live confirmation: the
  instrumented dev-stack run observed the update effect execute with
  `isStyleLoaded=false` ~300 ms after a successful `setData` — the units
  response of that cycle produced no `setData` call at all. It was visually
  masked only because a duplicate units request had already applied
  identical data.

Invariant the fix must satisfy (restated): the no-op window must become
impossible — the update path must key on source availability (or replay on
availability), not on the style's load state, which is false exactly in the
windows this component's own source/layer attachment and post-load tile
settlement create.

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
after load, (c) units resolve in the quirk window — all three must end with
the source holding every unit. Investigation updated the quirk window: the
drop happens in the post-addSource style-reloading window (see Confirmed
mechanism), not in the style-loaded-before-load frame, which self-heals
through the load handler's current-units read. The repro test named in the
Confirmed mechanism section is the mutation calibration: restore the old
guard and it must fail.

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
