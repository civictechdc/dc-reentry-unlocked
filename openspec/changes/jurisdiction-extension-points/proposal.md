# Proposal

## Why

The domain-driven review (`docs/domain-review.md`, finding DM-1, product
decision 2026-11-06) found the housing-inventory capability's core
requirement — "jurisdiction-specific fields as extension points rather
than core fields, so the same spec can be adopted by other cities" —
contradicted by the contract as built: `ward` and `quadrant` are required
core fields on `Unit` and `UnitCard`, restricted to DC's 1–8 wards and
four quadrants. The product owner decided a second jurisdiction is a real
requirement, not a north star: the contract work happens, not just spec
wording.

## What Changes

- Design and implement the jurisdiction extension mechanism: DC geography
  (ward/quadrant) stops being a hardcoded core field pair and becomes
  jurisdiction-scoped data behind a stable core model
- Migrate the contract (`packages/shared`), the synthetic dataset, the
  API serving surface, the filter definitions (the ward filter is
  jurisdiction data), and the web UI off hardcoded DC assumptions
- Keep the change additive-first per the contract stability rule: a
  versioned migration, not a breaking swap

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-inventory` — the versioned, city-agnostic model requirement
- `housing-inventory-api` — serving surface for jurisdiction data
- `dynamic-filtering` — jurisdiction-driven filter definitions
- `housing-search-ui` — jurisdiction-driven geography presentation

(Spawned at proposal stage with `skip_specs` set; delta specs are
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `packages/shared` (contract), `apps/api`, `apps/web`,
  `tools/datagen`, `data/` regeneration
- **Docs:** `docs/glossary.md`, `docs/shared-contracts.md`,
  generated `docs/data-model.md`
- **Sequencing:** after the pre-push pair (`dataset-seam-rule`,
  `honest-unknown-labels`); largest of the spawned proposals — plan
  deliberately
