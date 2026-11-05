# Design

## Context

`apps/web/src/routes/+page.svelte` lays out desktop as
`grid-template-columns: 1fr minmax(22rem, 26rem)` with
`grid-template-rows: auto minmax(0, 1fr)`: the map pane takes every pixel
left of the fixed ~22-26rem list column. On a maximized viewport the map
canvas is roughly twice as wide as tall; the shared row height leaves the
list's scroll window showing only ~3 cards.

## Decisions

**D1 — Constrain the map pane's aspect, don't stretch the map.** Candidate
mechanisms (implementation picks with live visual validation):
(a) an aspect-ratio cap on the map pane (square preferred, up to ~4:3
accepted) centered in its column, with the freed width going to the list
column or balanced whitespace;
(b) re-proportioned columns (wider list, map capped at its square width);
(c) both — aspect-capped map plus a modestly wider list. The map must
never overflow the viewport height, and the row stays viewport-height so
the page does not scroll as a whole.

**D2 — The list window is part of the fix, not a side effect.** Whatever
mechanism lands, the acceptance check counts visible unscrolled cards on a
maximized desktop viewport (target: several — around 5+ — final number
confirmed with the user in a walkthrough; ~3 is the failure being fixed).

**D3 — Mobile untouched.** The tabbed list-first mobile layout and its
conditional map mount are outside this change; e2e mobile specs must stay
green unmodified.

**D4 — Presentation criteria (AAID presentation route).** This is layout
work: the criteria are the proportions and the visible-card count, verified
visually in a live session; component tests pin structure (grid/proportion
rules present, no regression to `1fr` stretch), not pixel snapshots.

**D5 — Size-class map confirmed with the user before mid-width work.**
Known today: mobile = tabbed list-first with conditional map mount; desktop
= grid `1fr` + fixed list column. Unknown/unverified: mid-widths (tablet
portrait/landscape, narrow laptop) and mobile verification of the current
build. The survey task renders every size class on the running stack,
records what each does today, proposes a preferred form per class, and the
user confirms the set; the confirmed set is written into this change's spec
delta before any mid-width implementation. The desktop proportions fix
(D1–D4) proceeds regardless and must not break the confirmed mobile form.

**D6 — Confirmed set (user, 2026-11-05, visual-companion walkthrough).**
Desktop/laptop/landscape-tablet (>900px): desktop grid with a 4:3-capped
map pane centered in its column, list column `minmax(26rem, 32rem)`
(preview: map ≈987×704 at 1920×1080, 5 cards visible). Phones and portrait
tablets (≤900px): tabbed list-first form — the phone breakpoint moves from
768px to 900px so portrait tablets stop falling into a tall-sliver grid.
Survey fixes that land with it: the card list's implicit grid
track propagated the full ~117k-px card stack into page scroll geometry
despite `overflow-y: auto` (Chrome extends ancestor scrollable overflow
through clipped grid tracks) — fixed with `contain: layout` on the card
list; the map canvas's `min-height: 24rem` becomes a clamp; the map
pane's implicit grid track needs `minmax(0, 1fr)` so a capped pane
actually resizes (MapLibre's mount-time inline canvas width otherwise
deadlocks the track size).

**D7 — Phone map tab amendment (user, 2026-11-05, walkthrough adjust).**
The phone map tab gets the same square-ish treatment: portrait
square-capped (preview: canvas ≈390×353), landscape square-capped with
slimmer chrome — the tab bar floats over the map so the pane earns real
height (preview: canvas ≈270×196, ratio ≈1.4 vs today's 8:1 strip; a
plain square cap without the chrome change collapses to a ~48px sliver
because the legend wraps tall in narrow maps). A small border frames the
map pane (design tokens) so the centered map reads as a pane. List tab,
filter sheet, and detail sheet forms are unchanged.

## Risks / Trade-offs

- [Taste] "Square-like" is a product-voice call; wrong-guess cost is one
  CSS value, walkthrough-adjustable.
- [Viewport variety] Very wide or short viewports need the cap plus
  max-height to avoid a map taller than the screen; test both shapes.
