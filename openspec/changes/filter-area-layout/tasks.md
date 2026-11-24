# Tasks

Implementation follows the delta contracts and binding design decisions
(D1–D8). Human approval of planning artifacts, including removal of
`skip_specs`, is required before a later, separately approved
implementation session. Use behavioral-sentence test names,
Arrange-Act-Assert bodies, and fluent builders imported only from the
shared package's `testing` subpath in test files. Svelte component edits
go through the `svelte-file-editor` subagent where the harness supports
it, iterating with the svelte-autofixer. Numbered groups are sequential
reviewable blocks: record evidence and stop for human review after each
group before proceeding. Implementers never commit. Commands run from
the worktree root unless `-C` selects a workspace. Kill stray servers
before e2e (`lsof -ti :3000 -i :4317 -i :5173 | xargs kill`, then
`pkill -f "tsx watch src/server.ts"`). Keep tracking references inside
`openspec/`.

## 1. Desktop reserved summary band

- [x] 1.1 Restructure the desktop filter area per D1/D5: a summary band
  in `FilterBar.svelte` with the "Selected filters (N)" heading and the
  single conditional "Clear all filters" control on line 1, the bounded
  one-row chips presentation from `ActiveChips.svelte` on line 2, and an
  equal-height empty state (~76px band). Remove the footer clear-all and
  the chips-row clear-all. New chrome strings go through paraglide
  messages (regenerate; never hand-edit generated output). Verify:
  `pnpm -C apps/web test && pnpm typecheck`; visual check on the dev
  server at 1280×720 — empty, one chip, many chips.
- [x] 1.2 Add geometry e2e coverage: at 1280×720 and a maximized
  desktop viewport, applying, changing, removing, and clearing filters
  keeps the map pane's bounding rect identical (probe-style
  `getBoundingClientRect` assertions, matching the 2026-11-18 probe
  method). Record evidence and obtain human block review. Verify:
  `pnpm -C apps/web e2e && openspec validate filter-area-layout --strict`.

## 2. Desktop overflow popover

- [x] 2.1 Implement the `+N more` trailing trigger and the ~320px
  non-modal popover per D2: every applied chip with its removal control,
  light dismiss, focus moved in on open, Escape and close returning
  focus to the trigger. Reuse the chip removal control and accessible
  names; no new removal semantics. Verify: `pnpm -C apps/web test &&
  pnpm typecheck`.
- [x] 2.2 Extend e2e: with more selections than the row shows, the
  `+N more` affordance is visible; removing a value inside the popover
  unpresses the matching control and updates the row; re-applying a
  value resurfaces its chip; keyboard path (Tab into popover, remove,
  Escape) lands focus back on the trigger. Record evidence and obtain
  human block review. Verify: `pnpm -C apps/web e2e && openspec
  validate filter-area-layout --strict`.

## 3. Phone-width summary strip

- [x] 3.1 Rework the closed-state `.summary-row` in
  `MobileFilterSheet.svelte` per D3/D4/D5: count chips in the
  parenthetical format ("Ward (3 selected)", localized), activation
  opens the filter sheet with the selection unchanged (remove the silent
  remove-all), a trailing "+N more" chip opening the same sheet, the
  clear-all control fixed outside the scrolling chips area, and a scroll
  fade indicating more content. Verify: `pnpm -C apps/web test &&
  pnpm typecheck`; visual check at 390px — 1 filter, 3 filters, 6
  filters.
- [x] 3.2 Add mobile e2e: summary-row height and the centered map
  square's position are constant across apply/remove/clear; clear-all
  works on both tabs with the sheet closed; count-chip activation opens
  the sheet with selections unchanged; "+N more" is visible when content
  overflows. Record evidence and obtain human block review. Verify:
  `pnpm -C apps/web e2e && openspec validate filter-area-layout --strict`.

## 4. Feedback and focus continuity

- [x] 4.1 Add the `role="status"` result-feedback region per D6:
  concise matching-unit counts on apply/change/remove/clear, agreeing
  with the zero-results state on zero matches, never moving focus.
  Strings via paraglide. Verify: `pnpm -C apps/web test && pnpm
  typecheck`.
- [x] 4.2 Extend e2e for the accessibility contract: removal accessible
  names identify filter and value; after a keyboard removal focus lands
  on a logical neighbor, not the body; status announcements fire on
  apply and clear; the zero-results panel's chip-by-chip removal and
  clear-all still recover results (regression). Record evidence and
  obtain human block review. Verify: `pnpm -C apps/web e2e && openspec
  validate filter-area-layout --strict`.

## 5. Integration and review gates

- [x] 5.1 Confirm evidence covers every delta scenario (both spec
  deltas), then run the full deterministic gate set and the e2e suites
  against self-booted dev servers (stray-server kill first). The
  committed artifacts include `design/filter-area-layout.fig`; `.scratch/`
  stays gitignored. Never claim an unexecuted check passed. Verify:
  `pnpm lint && pnpm format:check && pnpm test && pnpm typecheck &&
  pnpm arch:check && pnpm -C apps/web e2e && pnpm -C apps/web e2e:bdd &&
  openspec validate --all --strict`.
- [x] 5.2 Obtain code review and security review; resolve findings and
  rerun affected checks. Integration review before handoff. Implementers
  never commit.

## Workflow follow-up

- Orchestrator alone commits after reviews and human approvals, using
  Conventional Commits; archive only after integration and review pass
  (`/opsx-archive` syncs deltas into main specs — the shared
  `dynamic-filtering` requirement text reconciles with
  `filter-target-semantics` per D7, whichever archives second).
- Walkthrough-record F2/W7 correction happens at the next docs touch,
  outside this change (user-signed record).
