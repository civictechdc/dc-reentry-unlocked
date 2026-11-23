# Design

## Context

See proposal.md — Why (W6–W8 verified defects and measurements; corrected
W7 mechanism) and What Changes. The surfaces this design reworks:

- Desktop: the `.desktop-layout` grid (`apps/web/src/routes/+page.svelte`)
  gives the filter pane an `auto` row above the map/list row — any pane
  height change displaces the map. `FilterBar.svelte` renders the
  schema-driven controls, a conditional footer clear-all, and
  `ActiveChips.svelte` (unbounded-wrapping per-value chips plus a second
  conditional clear-all).
- Mobile: `MobileFilterSheet.svelte` renders, with the sheet closed, a
  horizontally scrollable `.summary-row` of per-filter count chips —
  format `"{label}: {count}"`, activation silently removes all that
  filter's values, `overflow-x: auto` with no affordance; with the sheet
  open, a modal dialog holding the controls and per-value chips.
- No relevant UI code changed since the 2026-11-18 probe (git-verified
  2026-11-23); the measured baseline stands.
- Previewed variants with measured band heights live in
  `design/filter-area-layout.fig`, token-bound to DESIGN.md semantic
  roles; walkthrough copies under gitignored `.scratch/fal-preview/`.

## Goals / Non-Goals

**Goals:**

- Zero desktop map-pane displacement when filters are applied, changed,
  removed, or cleared; no mobile summary-row height change across the
  same interactions.
- Every applied value stays individually reachable for removal — inline,
  via the desktop overflow popover, or via the mobile sheet — never
  silently clipped.
- Clear-all on the summary's top line, outside scrolling chip content,
  reachable on phone-width screens with the sheet closed; conditional
  visibility retained without geometry change.
- A count-chip format that cannot read as a filter value.
- The research accessibility contract: specific removal names, focus
  retention after removal, concise matching-unit status announcements.

**Non-Goals:**

- No filter-semantics, matching, unknown-handling, or schema changes —
  `filter-target-semantics` owns those (shared boundary in D7).
- No change to control types or the controls' own layout (schema-rendered
  toggle groups stay as rendered).
- No per-value chips in the phone-width main strip — aggregated count
  chips stay; per-value chips remain inside the sheet.
- No desktop faceted sidebar (research rank 7: alternative, not default).
- No change to the zero-results panel — verified working; only
  regression-protected.
- No instant-versus-explicit apply changes; the mobile sheet keeps its
  Apply action.
- No walkthrough-record edits (user-signed; corrected at the next docs
  touch per proposal).
- Focused sheet-open (scrolled and ringed to the tapped filter) was
  previewed and declined — count-chip activation opens the sheet
  generically at the top.

## Decisions

**D1 — Reserved summary band, compact two-line, ~76 px (desktop).**
Line 1: "Selected filters (N)" heading with "Clear all filters"
right-aligned beside it. Line 2: one bounded row of per-value chips. The
band renders with identical height in its empty state (reserved, no
chips). Alternatives previewed and declined: single-line 48 px (fewest
chips visible before disclosure) and comfortable 92 px (tallest
permanent cost). Consolidates the current footer clear-all and
chips-row clear-all; net band is smaller than today's active band
(~93 px).

**D2 — Desktop overflow disclosure: `+N more` opens a non-displacing
popover.** When chips exceed the bounded row, a trailing `+N more`
chip-style trigger opens a ~320 px popover listing every applied chip
with its removal control. Declined: inline expansion (moves the map,
violating the W6 target) and pure horizontal scrolling (the verified W7
failure mode — silent). Popover contract: non-modal with light dismiss;
focus moves in on open; Escape and close return focus to the `+N more`
trigger.

**D3 — Phone-width count chips use the parenthetical count format**
(`"{label} ({n} selected)"`, localized via paraglide). The explicit
count word removes the "Ward 3" misread (verified W7 mechanism). The
middle-dot format was previewed and declined.

**D4 — Count-chip activation opens the filter sheet; it never removes
values by itself.** The current silent remove-all interaction is
removed; removal happens on per-value chips inside the sheet or via
clear-all. The focused open (sheet scrolled and ringed to the tapped
filter's group) was previewed and declined in favor of the generic
top open.

**D5 — Clear-all: single control, top line, conditional visibility,
reserved geometry.** Desktop: beside the summary heading (D1). Mobile:
fixed at the trailing edge of the summary strip, outside the
horizontally scrolling chips area. It renders only while a selection is
active, and the reserved space absorbs its appearance and disappearance
with zero height change.

**D6 — Feedback and focus continuity.** Matching-unit counts are
announced through a `role="status"` region on apply/change/remove/clear
— concise counts, never result lists, and never moving focus. Removal
controls keep accessible names identifying both filter and value (the
existing `chip_remove` message pattern); after a removal, focus moves to
a logical neighbor (another removal control or the summary), never the
page body. Keyboard focus within scroll strips must reveal the focused
chip.

**D7 — Shared `dynamic-filtering` boundary with
`filter-target-semantics`.** This change modifies only the presentation
side of "Active selections as removable chips" (summary layout,
disclosure, clear-all) and adds the filter-feedback requirement; it does
not touch matching semantics, unknown handling, schema shape, or
renderer control types. Cross-reference obligation (user decision
2026-11-18): each change's design cites the other; whichever archives
second reconciles the shared requirement text in `dynamic-filtering`.

**D8 — Band height figure.** The compact reserved band (~76 px) replaces
the "~93 px dense two-row band" reference in the `housing-search-ui`
desktop-density scenario; the delta updates that figure, and the map
pane gains roughly 17 px of row height versus today's active band.

## Risks / Trade-offs

- [Reserved band costs ~76 px permanently, even unfiltered] → accepted:
  the zero-shift target requires reserved space; the empty state makes
  the cost honest; the net band is smaller than today's active band.
- [Popover is a new overlay pattern with a focus and light-dismiss
  contract] → smallest surface satisfying non-displacement; contract
  pinned in D2 and asserted by scenarios.
- [Phone-width count chips still aggregate — values are one tap away in
  the sheet] → accepted per preview decision; every value remains
  reachable, satisfying the access requirement.
- [At 200 % zoom or narrow widths the bounded row holds fewer chips] →
  `+N more` appears earlier; disclosure preserves access.
- [Phone-width strip keeps a fixed cost above the map] → removes the
  verified growth shifts; stable geometry is the goal.
- [Controls and summary are two representations of one selection and
  could drift] → both render from the same store selection; e2e asserts
  consistency in both directions (removal unpresses the control; apply
  resurfaces the chip).

## Migration Plan

Single PR, web-app-only layout work; no API, schema, shared-contract, or
dataset changes, so rollback is a plain revert. No feature flag: the
blast radius is the filter area, covered by e2e geometry assertions and
human verification. The `.fig` variant file is committed with the change
(preview copies under `.scratch/` stay gitignored).
