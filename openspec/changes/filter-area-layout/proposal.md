# Proposal

## Why

Three medium-set walkthrough follow-ups (docs/feedback/2026-11-07-walkthrough.md,
items W6–W8) share one surface — the filter area's layout and its applied
selection summary. UI state verified live on 2026-11-18 (Chromium, dev
stack, measured DOM rects); verification verdicts below correct and sharpen
the original walkthrough record.

- **W6** (quote 1, verbatim): "when selecting a filter, can we keep the
  filter area static so the map doesn't move?". Verified: on desktop
  1280×720, applying filters shifts the map container down by **98 px**
  (top 281 → 379, height −98). Composition: chips row 27 px + two
  clear-all controls ≈62 px + grid gaps ≈13 px — the *duplicated
  clear-all controls contribute ~76 px, more than the chips themselves*.
  Each additional wrapped chip line costs ≈34 px. On the phone map tab
  the summary row grows 17 → 48 px, shifting the centered map square up
  16 px (then stable — further overflow goes horizontal).
- **W7** (quote 8, verbatim): "currently im showing mobile view and
  applied 3 ward filters. On the map tab, i only see ward 3 chip".
  Verified: **does not reproduce as clipping.** With wards 1, 4, 3
  applied, the mobile map tab shows exactly one chip — the per-filter
  count chip "Ward: 3" (filter label + selected-value count) — fully
  visible, 0 px hidden overflow; per-value chips do not exist in the
  mobile main UI at all (only inside the sheet and the zero-results
  panel). The original report matches a **misreading of the count chip**
  ("Ward: 3" reads as "Ward 3"). The real, verified defects: (a) the
  count-chip format is ambiguous; (b) at ≈6 distinct filters the
  summary row silently hides chips (measured: 3 of 6 clipped, row is
  `overflow-x: auto` with no visual affordance — scrollable, but
  nothing indicates more content).
- **W8** (quote 12, verbatim): "move clear-all/reset filters button to
  be near top line? maybe only appear once there's a filter applied".
  Verified: the **conditional-visibility half is already implemented**
  (both clear-all controls render only with an active selection), and
  the zero-results surface's clear-all works. Not satisfied:
  **placement** (both controls sit below the controls — FilterBar
  footer and beside the chips row — not near the top line), and
  **mobile reachability** (with the filter sheet closed there is no
  clear-all anywhere: none on the map tab, none on the list tab while
  results show).

## What Changes

- The filter area becomes layout-stable across filter apply/remove:
  reserved summary space (including its empty state) with bounded chip
  overflow, per the research recommendations — target: applying/removing
  filters causes zero map-container shift on desktop and no summary-row
  height change on mobile. The duplicated clear-all controls' ~76 px
  contribution is consolidated or reserved as part of this.
- The mobile applied-selection summary becomes legible: the count-chip
  format is disambiguated (a "Ward: 3" count chip must not read as a
  "Ward 3" filter), and hidden overflow gains a visible disclosure
  affordance (e.g. "+N more" / "View all" per the research) instead of
  silent horizontal clipping.
- Clear-all moves near the top line of the filter area (beside the
  applied-selection summary, outside any scrolling chip content),
  keeping the already-implemented only-when-active behavior, and
  becomes reachable on mobile without opening the filter sheet.

Planning consumes the W9 filter-patterns research captured in this
change at `research/filter-patterns.md` (the walkthrough gates further
filter UI work on it): ranked recommendations there cover reserved
summary space, overflow disclosure, top-line clear-all placement (MOJ
precedent), and the accessibility contract (removal names, focus
preservation, result-count status messages).

## Capabilities

### New Capabilities

### Modified Capabilities

- `dynamic-filtering` — "Active selections as removable chips"
  requirement (summary presentation, overflow disclosure, clear-all
  placement/visibility).
- `housing-search-ui` — "Map + card list layout" requirement
  (filter-area layout stability) and mobile behavior.

(Spawned at proposal stage with `skip_specs` set; delta specs, design,
and tasks are authored in this change's planning session, which unsets
it.)

## Impact

- **Code:** `apps/web/src/lib/components/MobileFilterSheet.svelte`
  (summary row + chips), `FilterBar.svelte` (footer/clear-all
  placement), `ActiveChips.svelte` (chips row + clear-all), and
  `apps/web/src/routes/+page.svelte` (filter-pane/mobile-shell layout).
- **Research:** `research/filter-patterns.md` (in-folder, 2026-11-18) is
  the gating input for this change's planning session.
- **Sequencing:** planning may proceed now (research landed). Kept
  separate from `filter-target-semantics` by user decision 2026-11-18 —
  both write deltas against `dynamic-filtering`, so each change's
  design must cross-reference the other's deltas and whichever archives
  second reconciles the shared requirement text.
- **Walkthrough-record correction (for the next docs touch):** the
  F2/W7 entry's mechanism is corrected by the 2026-11-18 verification
  (count-chip misread + silent overflow at ≈6 filters, not 3-ward
  clipping); the record itself is user-signed and is left untouched
  here.
