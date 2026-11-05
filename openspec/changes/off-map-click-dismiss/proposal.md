# Proposal

## Why

User walkthrough feedback (2026-11-05): today only a click on empty canvas
*inside* the map dismisses the pin label and the detail panel (plus Escape,
the close button, and the contentless-panel close). A user who clicks page
chrome outside the map — the filter bar, the header area, the page background
— expects the same dismissal and instead the label/detail linger. The
dismissal should follow the click wherever it lands outside the interactive
surfaces that own their own clicks (the map, the card list, the detail panel
itself).

## What Changes

- A document-level click dismissal path in MapView: a click that lands
  outside the map pane, the card list pane, the detail slide-over, and the
  phone tab bar clears the same state the empty-canvas click-off clears
  (card hover, pin hover, selection — closing the detail and its label)
- Focus honesty: this path does NOT restore focus to the opener — the
  clicked control keeps the focus the click gave it (unlike the close
  button / Escape / empty-canvas paths, which hand focus back)
- Spec delta: the detail-slide-over and pin-label requirements gain the
  off-map click path and scenarios
- Component tests: new dismissal cases + exclusion cases (list card, detail
  panel, tab bar must NOT dismiss); existing dismissal state machine and
  property suite stay green

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui`: detail-slide-over and pin-label dismissal requirements
  gain the click-outside-the-map path

## Impact

- **Code:** `apps/web` only — `src/lib/components/MapView.svelte`
  (outside-click listener + state clear), `src/lib/components/MapView.test.ts`
  (new cases)
- **APIs / Dependencies / Docs:** none
- **Sequencing:** independent; may land before or after `desktop-map-size`

## Non-goals

- No hover-away or timeout dismissal — dismissal stays strictly click-bound
- No change to in-map dismissal semantics (empty-canvas click, drag safety)
- Phone tab switching still preserves selection (the tab bar is excluded)
- No change to keyboard dismissal (Escape) or focus restoration on the
  existing close paths
