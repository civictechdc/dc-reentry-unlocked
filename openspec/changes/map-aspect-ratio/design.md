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

## Risks / Trade-offs

- [Taste] "Square-like" is a product-voice call; wrong-guess cost is one
  CSS value, walkthrough-adjustable.
- [Viewport variety] Very wide or short viewports need the cap plus
  max-height to avoid a map taller than the screen; test both shapes.
