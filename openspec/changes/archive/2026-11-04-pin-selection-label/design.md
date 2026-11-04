# Design

## Context

MapView (post first-load-pins) renders pins from a shared GeoJSON source with
two circle layers: `units-pins-base` and `units-pins-highlight` (filter-driven,
`getLayer`-guarded `setFilter`). The highlight identity today is
`hoveredCardUnitId ?? hoveredPinUnitId` — selection is NOT part of it, so a
selected unit loses its map cue when the detail panel takes focus, even though
the main spec's cross-highlighting scenario says selection highlights the pin.
Features carry only `id`/`selected`/`ward` properties (no address). The raster
style omits `glyphs` (maplibre ≥ 5.11 permits this; fonts then come from local
environment). CSP forbids arbitrary remote glyph/font hosts.

Research basis (maplibre-gl 6.16.0 docs + WCAG 2.1, verified 2026-11-03):
filter on a symbol layer limits displayed features; `setFilter(layer, null)`
REMOVES the filter (would label every feature — catastrophic with ~900 pins);
`text-field` supports `["get", …]`; `text-allow-overlap`/`text-overlap`
control collision suppression (configure at most one); WCAG SC 1.4.1 +
technique G14 (colour-conveyed info also in text); SC 1.4.13 obligations for
hover-triggered content; SC 1.4.3 contrast.

## Decisions

**D1 — GL symbol layer, not a DOM overlay.** A text-only `symbol` layer
(`units-pins-label`) over the existing `units-pins` source, attached in the
load handler above the circle layers. Keeps one rendering path (the wrapper
deliberately avoids per-pin DOM), needs no manual projection loop, and the
existing mock is already GL-shaped. A `Marker`/`project()` overlay would add a
second lifecycle to maintain.

**D2 — One identity for both cues.** Introduce
`hoveredCardUnitId ?? hoveredPinUnitId ?? selectedUnitId` and drive BOTH the
existing highlight filter and the new label filter from it. This fixes the
selection-loses-cue gap (aligning with the existing cross-highlighting
scenario) and guarantees label and highlight never disagree. Hover/focus
wins over selection while active; selection is the persistent fallback.

**D3 — Filter-driven label; address via feature property.** Add the unit's
`address` as a feature property in `unitsToFeatureCollection`; label layer
uses `text-field: ["get", "address"]`. Appearance/disappearance is ONLY
`setFilter` on the label layer: match-one-when active, explicit no-match
filter when idle. NEVER `setFilter(layer, null)` — documented semantics remove
the filter and would label every pin. No `setData` per hover (preserves the
no-source-churn design); address is static per unit, so source-time
properties suffice.

**D4 — Layout: cue cannot be silently suppressed.** `text-offset` above the
pin, contrasting `text-halo-color`/`text-halo-width` (SC 1.4.3 contrast),
`text-allow-overlap: true` so collision cannot drop the only non-colour cue
(do not also set `text-overlap`). Viewport-edge behaviour is a visual
question owned by browser e2e, not jsdom.

**D5 — Local fonts; no new remote dependency.** The style omits `glyphs`; the
first browser-e2e task must confirm a local font actually renders the label
in a real browser. If nothing renders with local fonts, STOP and surface
options (e.g. bundling a font/glyph set) — adding a remote glyph host is a
CSP change requiring explicit user approval.

**D6 — Lifecycle invariants inherited from first-load-pins.** Label layer
attaches in the load handler (after circles, from current identity at attach
time — covers mobile remount with a live selection after the List-tab
unmount); identity-driven `setFilter` is `getLayer`-guarded exactly like the
highlight effect; no window where an identity change silently no-ops without
a later replay (identity is plain uiState reads — the effect re-runs on every
change; attach reads current state).

**D7 — Accessibility framing (honest).** The current cue is not a proven
1.4.1 violation (highlight also changes radius 6→9 and stroke), so this is
G14-style hardening, not a violation fix. The label is a redundant VISUAL
cue: the semantic interface stays the existing `sr-pins` buttons with
localized aria-labels; the GL text adds no focus target or announcement.
1.4.13: the label is anchored to its trigger (the hovered/focused/selected
pin), small, and disappears when the trigger goes away — dismissal by trigger
removal; it must not obscure the card list (browser-e2e check).

**D8 — Mock and test upgrades.** The mock's `setFilter` must record the
target layer id and mutate that layer's stored filter (today it discards the
id — unprovable with two filtered layers), and gain `setLayoutProperty`
logging. Component tests assert: label layer definition (text-field, halo,
overlap, initial no-match filter), per-layer filter updates for hover →
focus → selection fallback → detail-close clear, and attach-from-current-
identity at load. Mutation-calibrate: (a) dropping the `?? selectedUnitId`
fallback must fail the persistence scenario; (b) a `null`-filter clear must
fail the clear scenario (filter must be no-match).

**D9 — Speech-bubble label background via a runtime stretchable icon.** The
bare-text label can clash with map tiles, so the label sits inside a white
bubble shape with a small centered tail pointing down at the pin. No style-spec
property paints a background behind text (halo only), and a DOM overlay stays
rejected (D1) — the bubble is a second runtime-registered image on the SAME
symbol layer: a procedurally generated RGBA bitmap (typed-array math, no
canvas, jsdom-testable) registered through the PUBLIC `Map.addImage`, whose
third argument (`options`) carries the metadata the runtime actually reads —
`pixelRatio`, `sdf`, `stretchX`, `stretchY`, `content` (the image argument
itself contributes only `width/height/data`; metadata inside the image object
is silently ignored). `stretchX` bands flank a FIXED center column (the tail
never smears), one `stretchY` band in the bubble body, `content` = interior
text box; the layer sets `icon-image` + `icon-text-fit: "both"` +
`icon-text-fit-padding` so the bubble sizes to the text. Under the fit,
`icon-anchor`/`icon-offset` proved inert — placement is tuned through
`text-offset` (empirically verified in the browser e2e). Solid bubble fill
replaces the halo paint (dropped). Overlap controls cover BOTH parts
(`icon-allow-overlap` alongside the existing `text-allow-overlap`). The
tail-on-pin proof is owned by the browser e2e (pixel assertions: ink inside
white bubble, bubble above the highlight ring, white tail between).

**D10 — Label text: street + ZIP, city/state trimmed structurally.** Feature
data carries a derived label string consumed by `text-field` — the full
address stays on cards, detail, and the sr-pin aria-labels. The derivation is
STRUCTURAL, not literal: parse the trailing `", <city>, <state> <ZIP>"`
segment shape (comma-separated tail whose last part is a state/ZIP form) and
rebuild as `<street> , <ZIP>` — no city name or state code is hardcoded, so a
future city expansion (none yet) needs no code change. An address whose
structure is not recognized renders unchanged rather than blank (unknown
honesty for future data); the recognized-shape rule lives in one tested
helper with table-driven cases.

## Risks / Trade-offs

- [card-map-focus overlap] Same files (`MapView.svelte`, `map-config.ts`,
  map tests). Sequencing: land after or together with card-map-focus; if it
  lands first, this change rebases onto its selection lifecycle.
- [Font availability unknown] jsdom proves filters, not rendered glyphs; the
  browser e2e gate owns the first real rendering proof (D5 stop condition).
- [Spec collision at archive time] `housing-search-ui` is also modified by
  active `map-aspect-ratio` and will be touched by `card-map-focus`; the
  ADDED requirement here avoids the MODIFIED carry-forward trap, but sync
  order still matters — re-run `openspec validate --all --strict` at archive.
