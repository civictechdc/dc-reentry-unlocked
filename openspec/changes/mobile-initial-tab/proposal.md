# Proposal

## Why

The domain-driven review (`openspec/changes/archive/2026-11-06-domain-driven-review/domain-review.md`, finding DM-12, product
decision 2026-11-06) found the housing-search-ui capability requiring the
"tabbed list-first form" at and below the 900px breakpoint — while the
implementation initializes `mobileTab` to `"map"` and the mobile e2e
suite explicitly expects map initially visible. The product owner
decided: **map-first is the intended truth.** The spec wording is what's
wrong; the shipped behavior and its tests stand.

This is a spec-reconciliation change: no product code changes.

## What Changes

- Update the responsive size-class requirement in `housing-search-ui` so
  the phone/portrait-tablet form reads map-first with on-demand list,
  matching shipped behavior and e2e expectations

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-search-ui` — the responsive size-class requirement's
  list-first wording

(Spawned at proposal stage with `skip_specs` set; the delta spec is
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** none
- **Docs:** none expected beyond the spec delta
- **Sequencing:** any time; trivial scope, good first candidate among
  the spawned proposals
