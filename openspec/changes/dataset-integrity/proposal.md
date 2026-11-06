# Proposal

## Why

Two domain-driven review findings (`docs/domain-review.md`: DM-4, CO-6)
concern the frozen dataset's integrity lockstep, left behind when
CO-1's seam-rule fix was split out to `dataset-seam-rule` (product
decision 2026-11-06):

- **DM-4:** the serving boundary validates record shapes but not the
  hierarchy's ownership invariants — nothing checks
  `unit.programId === program.id` or that the embedded provider/program
  nesting is consistent. The spec requires exactly one program per unit
  and one provider per program; today only the frozen dataset's shape
  happens to make it true. This matters the day ingestion is replaced.
- **CO-6:** `tools/datagen` re-declares the full provider/program field
  lists by hand instead of deriving them from the shared contract types
  the way the API loader does, so contract evolution compiles green in
  datagen and produces non-conforming datasets that fail only at API
  boot.

## What Changes

- Derive datagen's dataset types from the shared contract
  (`Program & { units: Unit[] }` idiom), making lockstep compile-time
- Add boot-time ownership/identity invariants alongside the existing
  conformance gate (belt-and-braces stays)
- Freeze the restored dep-cruiser seam rule as out of scope here — it
  lands separately and first as `dataset-seam-rule`

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-inventory` — hierarchy ownership requirement (if its
  enforcement posture changes)

(Spawned at proposal stage with `skip_specs` set; delta specs are
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `tools/datagen/src/generate.ts`, `apps/api/src/datasource.ts`
  (boot asserts), regeneration of `data/` (must stay byte-identical)
- **Docs:** none expected
- **Sequencing:** after `dataset-seam-rule` lands; before any ingestion
  replacement
