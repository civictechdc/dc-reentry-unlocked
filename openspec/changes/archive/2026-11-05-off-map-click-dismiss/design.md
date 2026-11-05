# Design

## Context

Dismissal today is a small state machine in MapView + DetailSlideOver with
four close paths (empty-canvas click, Escape, close button, contentless-panel
close), all converging on one all-dismissed terminal state (no card hover, no
pin hover, no selection), property-tested via `fc.commands` in
`map-selection-precedence.prop.test.ts` and row-tested in MapView.test.ts's
"dismissal state machine" describe. The close edge in DetailSlideOver
restores focus to the opener (`detailTriggerElement`) whenever a selection
closes. Clicks outside the map pane currently do nothing.

## Decisions

**D1 — Document-level click listener inside MapView, exclusion by
selectors.** A bubble-phase `document` click handler, registered while the
map is mounted, checks `event.target.closest()`. Excluded (keep-alive)
surfaces: the map itself (`.map-view` — its empty-canvas dismissal owns
in-map clicks), the desktop list pane (`.list-pane`), the detail slide-over
(`.detail`), and the phone tab bar (`.mobile-bar` — tab switching preserves
selection). Any other click target dismisses: clear `hoveredCardUnitId`,
`hoveredPinUnitId`, `selectedUnitId` — exactly the empty-canvas payload.

**D2 — No focus restoration on this path.** The DetailSlideOver close edge
fires on every selection→null transition and would call
`trigger.focus()`, yanking focus off the control the user just clicked. The
off-map handler therefore clears `uiState.detailTriggerElement` BEFORE
clearing the selection, so the close edge's `trigger && document.contains
(trigger)` guard skips restoration. The clicked control keeps the focus the
click gave it; a click on non-focusable background leaves focus where the
browser put it. Spec-scenario-pinned.

**D3 — Bubble phase, not capture.** Excluded surfaces get normal click
handling; the dismissal must not preempt them (a filter button still
applies its filter — and the dismissal alongside it is correct: clicking a
filter is an off-map click). Capture phase would run before target handlers
with no benefit here.

**D4 — Tests: new rows, machine untouched.** MapView.test.ts gains: dismiss
on a filter-bar/background click (jsdom `document` click on a stub chrome
element), keep-alive on list card click, keep-alive inside the detail panel,
keep-alive on the tab bar, focus-not-yanked assertion (clicked button still
holds focus after dismissal). The existing dismissal-state-machine rows and
the property suite (empty-canvas as the one dismissal command) stay as
they are — the off-map path converges on the same terminal state, and the
machine's guarantees are unchanged.

## Risks / Trade-offs

- Selector coupling: the exclusion list names page-chrome class names
  (`.list-pane`, `.detail`, `.mobile-bar`). Test-pinned so renames fail
  loudly, and MapView's test harness mounts the real page chrome stubs.
- Map drags that end outside the map pane (pointer down on canvas, release
  over the list): MapLibre suppresses the trailing click after a drag; the
  document listener sees no click. If a raw drag-past-edge click ever
  leaks, the exclusion list still guards the list.
