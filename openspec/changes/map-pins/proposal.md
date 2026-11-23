# Proposal

## Why

Three medium-set walkthrough follow-ups (docs/feedback/2026-11-07-walkthrough.md,
items W3–W5) share one surface — the map's pin/label system and its link to
the card list:

- **W3** (quote 10, verbatim): "add the housing title above the address line
  in the pin label e.g. Westgate Bridge Housing / 1692 MISSOURI AVE NW,
  20011". Today's label carries only the address line.
- **W4** (quote 11, verbatim): "can the text in the label be highlightable?"
  — i.e. selectable/copyable label text. The live label is a MapLibre
  symbol layer (WebGL glyphs, deliberately "no per-pin DOM markers" for
  performance), and WebGL glyph atlases are not user-selectable text. Any
  selectability needs a DOM surface; the performance posture must either be
  preserved (e.g. a single DOM overlay for the *live* label only) or
  revisited deliberately in planning.
- **W5** (quote 3, verbatim): "possibly scroll list to the selected item
  when the pin is selected?". Pin↔card cross-highlighting already exists
  (housing-search-ui "Pin-card cross-highlighting"); the missing piece is
  bringing the selected unit's card into the list's visible scroll region.

## What Changes

- The pin label renders the housing title above the address line — expected
  shape: two-line label text in the symbol layer's field expression, with
  collision/anchor/offset adjustments for the taller label box; exact
  mechanism decided in planning.
- The live (selected/hovered) label's text becomes selectable and copyable;
  per-pin DOM markers stay out of scope unless planning decides otherwise
  with evidence.
- Selecting a pin scrolls the unit list so that unit's card is visible
  (scroll-margin so the highlight is not flush-clipped). Phone behavior —
  whether selecting a pin on the map tab switches to the list tab or not —
  is an explicit planning decision.

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui` — pin-label content, live-label selection behavior,
  pin→list scroll linkage (extends "Map + card list layout" and the
  detail/label dismissal requirements).

(Spawned at proposal stage with `skip_specs` set; delta specs, design, and
tasks are authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `apps/web/src/lib/components/MapView.svelte` (label layer text
  + any live-label DOM overlay), `UnitCardList.svelte` (scroll-to-card),
  possibly `lib/state/ui-state` for selection/scroll coordination.
- **Docs:** none expected beyond spec deltas.
- **Sequencing:** independent of `filter-area-layout` and
  `detail-card-height`; no dependencies on the rest-bucket changes.
  Feasibility notes the planning session must own: (1) symbol-layer glyphs
  cannot be made selectable — W4 requires a DOM overlay for the live label
  or an accepted scope cut; (2) two-line labels enlarge collision boxes and
  may change visible-label density at low zooms; (3) the map observability
  hooks (`data-pin-points` / `data-label-unit`) that e2e relies on must
  keep working through any label-layer change.
