# Proposal

## Why

The map highlights a hovered/focused/selected pin by colour and size alone. A
colour-blind user may not reliably identify which pin a card interaction
refers to (WCAG 2.1 SC 1.4.1 Use of Color; technique G14 — information
conveyed by colour differences must also be available in text). Today's cue
also has a gap: the highlight follows hover only, so a selected unit loses its
map cue entirely once the detail panel takes focus.

## What Changes

- Add a text label (the unit's address) that appears on the map pin whenever
  that unit is the active highlight target — card hover/focus, pin hover, or
  selection — and disappears when the unit is no longer active (blur, hover
  moving elsewhere, detail close/deselect)
- Extend the highlight identity to include selection as the fallback after
  hover/focus (`hoveredCard ?? hoveredPin ?? selected`), so a selected unit
  keeps BOTH its colour highlight and its label while the detail panel is
  open — aligning the implementation with the existing cross-highlighting
  scenario, which already says selection highlights the pin
- Implement as a text-only symbol layer over the existing shared GeoJSON
  source, driven by a single-feature filter (no per-hover source rewrites, no
  DOM overlay path)
- No new user-facing strings: the label text is the unit's address, already
  domain data rendered on cards and exposed to screen readers via the
  existing pin buttons

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-search-ui`: ADDED requirement "Pin activity label" — a non-colour
  (text) cue accompanies pin highlighting, following the same hover/focus/
  selection identity, with appearance/disappearance tied to that identity

## Impact

- **Code:** `apps/web` only — `map-config.ts` (address feature property,
  label-layer definition + filter helper), `MapView.svelte` (label layer
  attach + identity-driven filter effect), `MapView.test.ts` (mock gains
  per-layer filter state and `setLayoutProperty`; label lifecycle tests),
  browser e2e (real glyph rendering, hover/selection, mobile remount)
- **APIs / Dependencies:** none (no glyph-server addition; the raster style
  omits `glyphs` and local fonts must be verified — see design)
- **Docs:** none expected
- **Sequencing:** land AFTER or TOGETHER WITH `card-map-focus` — both change
  MapView's selection-driven effects and the same files
  (`MapView.svelte`, `map-config.ts`, map tests); this change assumes the
  focused-camera lifecycle it introduces (including mobile map remount with
  an existing selection)

## Non-goals

- No change to pin colours, sizes, or the card list/detail content
- No label for units that are not the active highlight target (exactly one
  label at a time)
- No new map legend entry, tooltip system, or i18n strings
