# Proposal

## Why

User walkthrough feedback (2026-11-05, live session at desktop width): the
map pane renders too small and the chrome around it too generous. Measured at
1440×900: the filter bar wraps to two rows (193px), the map row gets only
519px, the 4:3-capped map renders 692×519 with ~100px dead margin on each
side, and 0.75rem gap + padding sits between map and list. The user previewed
two live variants (injected CSS on the running dev app) and picked the one
that relaxes the cap to 3:2 on top of compacted chrome: 904×651 at 1440×900
(+64% area) and ~1218×812 at 1920×1080, versus 692×519 today.

## What Changes

- Desktop map aspect cap: 4:3 → 3:2 (`.map-pane` container-query width cap);
  amends the archived `map-aspect-ratio` decision — user-confirmed after the
  live A/B preview
- Filter bar density: tighter paddings/gaps and one step down in control
  typography so the filter controls fit one row at desktop widths (~93px
  instead of 193px at 1440)
- Layout chrome: desktop grid gap and padding 0.75rem → 0.5rem; height
  overhead `calc(100vh - 9.5rem)` → `calc(100vh - 8.25rem)` (reclaims dead
  bottom slack; short-viewport clamping must still hold)
- Layout/component test pins move with the cap (3:2) and gain the compaction
  invariants; structural invariants (shrinkable tracks, no overflow, no
  whole-page scroll) unchanged

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui`: the desktop map pane cap requirement moves from
  "capped near 4:3" to "capped near 3:2" with refreshed example proportions

## Impact

- **Code:** `apps/web` only — `src/routes/+page.svelte` (cap, gap, padding,
  height calc), `src/lib/components/FilterBar.svelte` (density),
  `src/lib/layout/desktop-grid.test.ts` (pins)
- **APIs / Dependencies / Docs:** none
- **Sequencing:** independent of other planned changes; both touch points
  (`+page.svelte`) are shared with `bed-available-label` only trivially

## Non-goals

- No change to the phone map tab (its square-ish form is spec-pinned
  separately and untouched)
- No filter redesign: no controls removed, no collapse/expand affordance —
  spacing/typography density only
- No change to the list column width (26–32rem) or map/list order
