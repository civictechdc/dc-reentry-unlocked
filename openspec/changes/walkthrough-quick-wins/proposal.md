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
  the feature-flag mechanism (now landed: per-flag compile-time defines
  with the dev-only `?flags=` override); unconditional fixes (`tel:`,
  favicon, close icon) land directly
- First flag-rider duties inherited from the feature-flags change
  (recorded in its archived design): the build-output elimination scan —
  fails if any `vite build` output contains guarded-feature code or a
  stray `__FLAG_*__`/`__DEV_SERVER__` identifier — a registry
  name-shape/uniqueness unit check (the registry gains its first real
  entries here), and a "flags are never a security boundary" line in the
  flags module docs
- Sequencing: feature-flags has landed (user decision 2026-11-07 — this
  change is its first consumer); plan after `mobile-initial-tab` so the
  `housing-search-ui` delta is authored against the corrected responsive
  wording instead of racing another delta into the same main spec

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui` — map controls and detail-card close affordance
  (delta spec authored in planning; `skip_specs` unset then)

## Impact

- **Code:** `apps/web` (map component controls, detail card, phone
  rendering, app favicon/static assets) plus the flag-rider duties above
  (registry check, elimination scan, flags docs)
- **Docs:** the flags module docs line (never a security boundary); none
  beyond the walkthrough record already committed
- **Sequencing:** after `mobile-initial-tab` (spec-wording fix); after
  feature-flags (landed 2026-11-07) as its first rider
