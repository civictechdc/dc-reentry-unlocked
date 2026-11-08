# Proposal

## Why

The first live walkthrough session (2026-11-07, recorded in
`docs/feedback/2026-11-07-walkthrough.md`) produced five small,
well-defined items that need no research and no design debate:

- **W1** on-screen map zoom controls (+ / −) — quote 7
- **W2** recenter control on the configured locale (DC today, other
  cities later) — quote 9
- **W11** close-detail control as an icon / "×" — quote 16
- **W13** phone numbers as `tel:` links — quote 19
- **W19** serve a favicon (404 on every boot observed) — friction F8

They share one trait: too small to warrant separate changes, too user-
visible to batch invisibly into other work.

## What Changes

- The five items above as one scoped change
- Candidate-behavior items (zoom buttons, recenter) are trialed behind
  the feature-flag mechanism where flags apply; unconditional fixes
  (`tel:`, favicon, close icon) land directly — the split is a planning
  decision against whatever the flag mechanism ends up being
- Sequencing: after the feature-flag change lands (user decision
  2026-11-07 — this change is its first consumer)

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui` — map controls and detail-card close affordance
  (delta spec authored in planning; `skip_specs` unset then)

## Impact

- **Code:** `apps/web` (map component controls, detail card, phone
  rendering, app favicon/static assets)
- **Docs:** none beyond the walkthrough record already committed
- **Sequencing:** feature-flags first (user decision 2026-11-07); this
  change follows immediately as its first rider

(Spawned at proposal stage with `skip_specs` set.)
