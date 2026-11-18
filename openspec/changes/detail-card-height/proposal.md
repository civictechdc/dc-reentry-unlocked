# Proposal

## Why

Walkthrough follow-up W10 (docs/feedback/2026-11-07-walkthrough.md):

- Quote 14 (verbatim): "detail card should be vertically shorter rather
  than spanning the full height of the screen on larger screens". Current
  CSS confirms the complaint's cause: the desktop slide-over is
  `position: absolute; inset-block: 0` inside the map pane — it spans the
  pane's full height by construction (the phone bottom-sheet variant
  already carries its own `max-height` cap and is not the complaint).
- Quote 15 (verbatim): "for that feature wehn we work on it, we should
  preview potential height options" — the user requires previewable
  candidate height options to choose from, not a single imposed value.

## What Changes

- The desktop detail slide-over gets a height cap so it no longer spans
  the full pane on large screens. Candidate options (illustrative, to be
  firmed up in planning): content-hug with a viewport-fraction
  `max-height` and internal scroll, fixed viewport-fraction heights,
  alignment variants (top-anchored vs vertically centered).
- Candidate height options are presented as previewable design variants
  the user selects from before implementation finalizes the value —
  design mockups are preview-only; `apps/web/DESIGN.md` remains the
  design-token source of truth, and mockup files live under `design/`
  and are committed with the task.
- Phone bottom-sheet behavior is unchanged (already capped; the
  complaint was large screens).

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui` — "Unit detail slide-over" requirement gains the
  large-screen height-cap scenario (and the preview-driven selection
  obligation lands in the change's design/tasks, not the spec).

(Spawned at proposal stage with `skip_specs` set; delta specs, design, and
tasks are authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `apps/web/src/lib/components/DetailSlideOver.svelte`
  (height/position styles only expected).
- **Design:** preview variants for the candidate heights (committed
  under `design/` with the task's work).
- **Sequencing:** independent; consumes the design language already
  settled by the archived design-language change (tokens from
  `apps/web/DESIGN.md`). No interaction with `map-pins` or
  `filter-area-layout` beyond sharing the detail-pane surface —
  ordering between them is free.
