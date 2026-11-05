# Proposal

## Why

After a pin interaction the label (and the open detail) linger until an
explicit close. Users expect outside-interaction dismissal — the
tap-outside-to-dismiss pattern that Material Design and Apple's HIG
legitimize for sheets and popovers-like surfaces (documented products such
as Google Maps InfoWindows pair a close control with Escape rather than
background-click). A related precedence defect surfaced in review: after
clicking pin A and then selecting card B, ending a hover returns the label
to A (the stale pin-hover id) instead of the selected unit B — the existing
hover-precedence scenario is silently violated.

## What Changes

- Clicking empty map canvas — a true click, never a click-drag or tap-drag
  pan — clears the selection, closes the detail slide-over, and removes the
  pin label and highlight
- A new selection clears the stale pin-hover id, so "the selected unit's
  label returns when hover ends" holds after mixed pin/card interactions
  (aligns the implementation with the existing scenario; no wording change)
- No new UI chrome; the close button and existing detail-close paths stay
- Closing the detail (close button, Escape, or canvas click) returns focus
  to the trigger that opened it — the card or pin button — instead of
  dropping focus to the page

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-search-ui`: MODIFIED requirement "Pin activity label" — adds the
  click-off dismissal scenario; MODIFIED requirement "Unit detail
  slide-over" — adds the canvas-click close path alongside the pin-open
  scenario

## Impact

- **Code:** `apps/web` only — `MapView.svelte` (map-wide click handler with
  drag discrimination + no-pin-hit check; selection paths clear the stale
  pin-hover id), `DetailSlideOver.svelte` (focus return to the trigger on
  every close path), `MapView.test.ts` (click-off, drag non-dismissal,
  stale-pin precedence), browser e2e additions
- **APIs / Dependencies:** none
- **Docs:** none expected
- **Sequencing:** none (builds on the landed pin-selection-label; the
  archived change's main-spec requirements are the base being modified)

## Non-goals

- No Escape-key dismissal or focus-based dismissal (existing close paths only)
- No change to pin hover color/size behavior or label content
- No mobile-specific gesture beyond the tap-vs-tap-drag distinction
