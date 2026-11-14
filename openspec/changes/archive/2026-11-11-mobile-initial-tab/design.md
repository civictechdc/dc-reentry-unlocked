# Design

## Context

Finding DM-12 of the archived domain-driven review (product decision
2026-11-06): the housing-search-ui spec's responsive size-class scenario
requires "the tabbed list-first form with on-demand map" at and below the
900px breakpoint, while the shipped app initializes the phone form on the
map tab and the mobile e2e suite expects exactly that. The product owner
decided map-first is the intended truth; the spec wording is what changes.
See proposal.md for motivation.

Shipped facts this design relies on (verified in-repo and in-browser,
2026-11-11):

- `apps/web/src/lib/state/ui-state.svelte.ts` initializes `mobileTab`
  to `"map"`.
- `apps/web/e2e/mobile.spec.ts` asserts the map view is visible on load
  with the list hidden ("map tab active by default").
- Live check at a 390x844 viewport against the dev boot: the Map tab is
  the selected tab and the map view renders before any interaction.

The list-first wording lives in exactly one scenario ("Responsive size
classes render their confirmed forms") of the "Map + card list layout"
requirement in `openspec/specs/housing-search-ui/spec.md`. The "Mobile
responsive behavior" requirement already reads "Map/List tabbed
navigation" — no initial-tab claim, map named first.

## Goals / Non-Goals

**Goals:**

- Make the spec read map-first for phones and portrait tablets, matching
  the product decision, shipped behavior, and the e2e expectations that
  stand.
- Land the correction through the normal delta-then-archive workflow so
  the main spec's change history stays auditable.

**Non-Goals:**

- No app, test, or doc changes — code and e2e stand exactly as shipped.
- No mobile UX work beyond wording (walkthrough items like the mobile
  chip clipping are separate changes).
- No rewrite of the "Mobile responsive behavior" requirement.

## Decisions

- **Spec-only MODIFIED delta on one requirement.** Copy the entire
  "Map + card list layout" requirement block into the change's delta
  spec and reword the one scenario's THEN from "the tabbed list-first
  form with on-demand map" to "the tabbed map-first form with on-demand
  list (map tab initially active)". The parenthetical pins the initial
  tab explicitly so the scenario is directly testable and cannot be read
  as word ordering alone. Alternative considered: also rewording the
  "Mobile responsive behavior" requirement — rejected; its wording is
  already consistent and the minimal-diff principle applies.
- **Main spec updates at archive time, not by direct edit.** The delta
  lives in the change folder; the archive workflow integrates it into
  the main spec. Alternative considered: a task editing
  `openspec/specs/housing-search-ui/spec.md` directly — rejected; it
  bypasses the delta audit trail that validation and review rely on.
- **No implementation tasks.** The change produces planning artifacts
  only; its apply-phase tasks verify that nothing else moved and that
  the repo gates pass.

## Risks / Trade-offs

- [MODIFIED block drifts from the main spec before archive] -> the block
  is extracted verbatim from the main spec with exactly one THEN line
  changed; `openspec validate --strict` and the archive-time diff gate
  it.
- [A reader takes "map-first" as tab-bar ordering, not initial state]
  -> the explicit "(map tab initially active)" parenthetical removes the
  ambiguity.
