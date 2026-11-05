# Design

## Context

Desktop layout today (`+page.svelte`): grid `minmax(0,1fr) minmax(26rem,32rem)`,
`gap: 0.75rem`, `padding: 0.75rem`, `height: calc(100vh - 9.5rem)`; the map
pane is a size container and `.map-pane :global(.map-view)` caps at
`width: min(100%, calc(100cqh * 4 / 3))`. Measured on the live dev app
(2026-11-05): at 1440×900 the filter bar wraps to two rows (193px tall), the
map row gets 519px, the map renders 692×519 with ~100px dead margin per side,
and ~30px of the height calc is dead bottom slack. `desktop-grid.test.ts`
pins the 4/3 cap expression and the structural invariants.

The user previewed two injected-CSS variants live and picked 3:2 + compacted
chrome (decision 2026-11-05): 904×651 at 1440×900, ~1218×812 at 1920×1080,
short-viewport 1440×660 still clamps (616×411, no page scroll).

## Decisions

**D1 — Cap 3:2, pane-scoped as before.** One expression change
(`calc(100cqh * 4 / 3)` → `calc(100cqh * 3 / 2)`) in `+page.svelte`; the cap
stays pane-scoped so the phone map tab (no size container) keeps its
full-width stretch. The map stays height-bound; at 1920×1080 the cap still
leaves a small (~80px/side) margin — accepted, square-ness was the taste the
user confirmed, not edge-to-edge fill.

**D2 — Filter bar density: a compact ~93px band at 1440-class widths.**
Tighter paddings (0.375rem 0.75rem), tighter gaps (0.375rem / 0.375rem 0.75rem),
and one typography step down on controls (0.8rem labels, toggles, selects,
footer). The controls still wrap to two dense flex lines even at 1440×900 —
a literal single line would need ~2390px of width — but the compacted band is
~93px tall instead of today's 193px. No controls removed, no collapse
affordance.

**D3 — Layout chrome tightened.** Grid gap and padding 0.75rem → 0.5rem
(the padding gap the user felt between map and list); height calc
`100vh - 9.5rem` → `100vh - 8.25rem` to reclaim measured dead bottom slack.
Verified against the short-viewport scenario (1440×660): map clamps in its
row, no whole-page scroll.

**D4 — Test pins move with the values, structure stays.**
`desktop-grid.test.ts`: the cap expression assertion moves to `3 / 2` (and
the negative assertion must not reintroduce 4/3-as-a-strip regressions);
add density pins (filter-bar paddings/gaps, layout gap/padding values) so
the compaction is itself pinned; keep every structural invariant
(shrinkable tracks, `container-type: size`, pane-scoped cap, no `100cqh`
leak into the shared map component, list scroll containment).

## Risks / Trade-offs

- [Taste] 3:2 is less square than the archived 4:3 decision — user-confirmed
  against a live A/B preview; wrong-guess cost is one expression.
- Filter band height depends on content width and is non-monotonic: the
  controls wrap to two dense lines at all desktop widths (~93px at
  1440-class widths, ~112px at 1920 where the selects join the fieldsets
  line). No fixed-height promise in tests.
