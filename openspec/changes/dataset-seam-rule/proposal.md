# Proposal

## Why

The domain-driven review (`docs/domain-review.md`, finding CO-1, product
decision 2026-11-06) found that the dep-cruiser rule
`api-route-must-not-read-dataset-directly` — the executable backstop for
the ingestion-pipeline seam — matches `data/units.v\d+\.json`, a filename
pattern that no longer exists: the frozen dataset has been
`data/units.json` since the schema-version 0.2 rename. The rule guards
nothing today; a route module statically importing the dataset would pass
`pnpm arch:check`. The rename also proved the rot is silent — dep-cruiser
cannot report a rule whose match set is empty.

## What Changes

- Fix the rule's `to` pattern to match the current dataset path
- Add a rot-guard test (repo-tool suite) asserting the dataset rule
  actually matches the files in `data/`, so the next rename fails loudly
  instead of silently disarming the seam

## Capabilities

### New Capabilities

### Modified Capabilities

(Decided at planning: the dev-environment capability may or may not carry
a requirement for this backstop; this proposal is spawned at proposal
stage with `skip_specs` set, to be revisited in its planning session.)

## Impact

- **Code:** `.dependency-cruiser.cjs` (one rule), one new test in the
  repo-tool suite
- **Docs:** none expected
- **Sequencing:** pre-push priority (product decision 2026-11-06); lands
  before the larger `dataset-integrity` proposal
