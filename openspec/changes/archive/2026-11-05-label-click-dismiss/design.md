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

**D2 — Drag discrimination via MapLibre's own click semantics.** RESOLVED
by prototype: MapLibre's handler manager natively suppresses `click` after
a drag (an 80px stepped mouse-drag emitted zero click events in a headless
probe) — no explicit `dragstart`/`dragend` guard is needed; keep one anyway
only if the e2e drag tests falsify the native suppression on any supported
browser. The e2e suite proves both directions with real gestures (click-off
dismisses; drag-pan does not).

**D3 — Stale pin-hover cleared on new selection.** Whenever a selection
lands on a unit through a NON-pin path (card click, keyboard card
activation, keyboard pin-button activation), clear `hoveredPinUnitId` —
the canvas pin click path keeps setting both, since its hover id matches
its selection. Implement at the selection call sites in MapView and the
card list rather than inside uiState, keeping the store dumb.

**D4 — Detail closes through the existing mechanism.** The slide-over
renders from `selectedUnitId`; clearing it (click-off or close control)
closes the panel. No new close plumbing.

**D5 — Behavior validated before implementation (prototype + UX check).**
An interactive prototype (real map-config bundle, live map, Current vs
Proposed toggle) confirmed the feel with the user, and an evidence-backed
UX review found the pattern conforming: outside-interaction dismissal is a
legitimized sheet/popover pattern (Material, Apple HIG) whose caveats this
design already honors — the explicit close button stays, and the dismissed
state is a transient selection with no user input, so accidental-dismissal
cost is low (Apple's caveat concerns lost work; none exists here). Two
findings recorded honestly: (a) documented map products (Google Maps
InfoWindows) specify close-control + Escape, NOT background-click — the
support for this behavior is the general outside-interaction pattern, not a
map-product convention; (b) the keyboard dismissal expectation is already
met by the existing window-Escape handler in the detail slide-over, which
this change reuses unchanged. Prototype bonus finding: clicks pass through
the label bubble to the pin beneath (queryRenderedFeatures does not
occlude), so the bubble can never steal a pin's click.

**D6 — Focus returns to the trigger on every close path.** Track the
trigger element when a selection opens the detail (the card button or pin
button that carried the interaction); on close — close button, Escape, or
the new canvas click — restore focus to it if it is still in the DOM
(keyboard-accessibility expectation: focus should not silently drop to the
page body after a dismissible surface closes). With no live trigger (e.g.
the opening card left the result set), leave focus where the browser puts
it rather than guessing.

Resolution added 2026-11-04 (user-accepted): restoring focus re-fires the
opener's focus handler, whose hover coupling re-lit the address label
right after close — a second dismissal click was needed to clear it. The
close-edge restore now clears the card-hover id immediately after
`trigger.focus()`, so ANY single close (button, Escape, canvas click)
fully dismisses selection + detail + label at once; a later genuine
tab-to-the-card still lights the label normally. Canvas pin clicks map
their trigger to the unit's screen-reader pin-list button (resolvable by
`data-unit-id`), the only DOM control representing a canvas pin.

## Risks / Trade-offs

- [Map-wide click vs layer clicks] Both handlers can observe one physical
  click; the no-pin-hit guard is the single discriminator — covered by a
  jsdom test where a pin hit must NOT clear.
- [Touch tap-vs-drag thresholds] MapLibre's internal threshold decides;
  if docs leave it ambiguous, the e2e tap-drag test is the arbiter and the
  guard from D2 becomes mandatory.
- [Phone tap-off reachability — measured 2026-11-04, user-accepted] The
  open detail bottom sheet renders at the FULL phone viewport for every
  unit (fixed sheet anchored at y=0; the map canvas sits entirely beneath
  it), so a tap-off has no reachable canvas while a selection is live.
  Click-off dismissal is therefore e2e-proven on desktop only; the
  reachable touch half (tap-drag pans, never dismisses, no phantom click)
  is proven on the phone viewport. Making the sheet smaller to expose the
  canvas is outside this change (non-goals: no mobile-specific UI change)
  — surfaced as a candidate for a future change if wanted.

**D7 — Canvas pin hover shows a transient label (added 2026-11-04, user
request).** Layer-scoped `mouseenter`/`mouseleave` on the pin layer set
and clear `hoveredPinUnitId` — the slot already sits at its precedence
position (card hover above, selection below), so the highlight and label
filters need no new plumbing. A short enter intent-delay (tens of
milliseconds; initial 30 ms, final value tuned in the interactive user
demo) keeps a pointer sweeping across pins from flickering labels; a
leave cancels any pending enter timer and clears immediately. Pin hover
never selects the unit nor opens the detail; clicking a hovered pin
selects exactly as today. Touch has no hover concept — the proof surface
is the desktop pointer. The feel and the final delay value are verified
in an interactive demo with the user before the task is ticked.
Refinement (review finding, fixed 2026-11-05): MapLibre's layer-scoped
`mouseenter` does not re-fire for pin-to-pin travel inside one layer, so
a layer-scoped `mousemove` re-arms the intent timer whenever the feature
under the pointer changes — overlapping or abutting pins can never leave
a wrong-name label resting beyond one delay.
- [Spec sync] Both modified requirements live in `housing-search-ui`,
  which active `map-aspect-ratio` also touches — re-run
  `openspec validate --all --strict` at archive and sync before it lands
  the same way pin-selection-label did.
