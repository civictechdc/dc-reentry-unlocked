# Proposal

## Why

Five domain-driven review findings (`docs/domain-review.md`: DM-3, DM-5,
DM-9, CO-4, CO-12; decoupling confirmed by product decision 2026-11-06)
share one root: filter semantics are keyed on the wrong thing and spread
across the wrong sides of the seam.

- **DM-3:** the frontend validates filter-target membership it never
  uses, so a new backend filter over a new field fails the *whole*
  filter bar in an older frontend — violating the no-frontend-release
  scenario the product owner confirmed is binding.
- **DM-5 / CO-4:** unknown-matching behavior branches on control type
  (single-select honors unknowns, multi-select doesn't — "a ward is never
  unknown" as a comment), while unknown-possibility is a property of the
  *target field*; `filter-params.ts` special-cases `unit.ward` inside a
  module that promises nothing is hardcoded.
- **DM-9:** the AND-across/OR-within filter algebra exists only in code
  and tests; no capability spec states it.
- **CO-12:** `HousingUnitsSource` advertises a per-source `filterSchema`
  the matcher ignores (latent, factory-pinned today).

## What Changes

- Web stops validating target membership (shape check only); new-target
  filters render like any other, per the literal scenario
- `FilterTarget` gains the metadata the semantics actually key on
  (resolvability, unknown-possibility), and matching behavior derives
  from target properties instead of control branches; the `unit.ward`
  special case dissolves
- The filter combination algebra (OR within a filter, AND across) is
  written into the API capability and referenced from dynamic filtering
- The matcher iterates the source instance's schema, aligning the seam
  with its advertisement

## Capabilities

### New Capabilities

### Modified Capabilities

- `dynamic-filtering` — schema-rendered UI promise, decoupling
- `housing-inventory-api` — matching algebra, unknown semantics

(Spawned at proposal stage with `skip_specs` set; delta specs are
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `packages/shared/src/filters.ts`, `apps/api/src/datasource.ts`
  + `filter-params.ts`, `apps/web/src/lib/api/filters-response.ts` (+ the
  query test that currently pins rejection)
- **Docs:** `docs/glossary.md` (filter schema / control type entries)
- **Sequencing:** after the pre-push pair; interacts with
  `consumer-enum-tolerance` (intake posture) — sequence their planning
  together
