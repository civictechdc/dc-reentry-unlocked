# Proposal

## Why

The unit/housing data model's documentation is hand-maintained in multiple places (`docs/shared-contracts.md` field lists and examples, the data-model-reference skill's contract description), and every contract refinement means hand-editing each — the exact-addresses-only change had a whole task for it, and the planned documentation-review change exists partly to hunt the drift this creates. The source of truth is already machine-readable: the TypeBox schemas in `packages/shared` (which are JSON Schema). The spec documentation should be GENERATED from the schemas and refreshed mechanically as the data model is refined and confirmed — prose drift becomes impossible instead of policed.

## What Changes

- A model-doc generator: renders the Unit/UnitCard/envelope schemas + SCHEMA_VERSION into a committed reference doc (`docs/data-model.md`) — field tables, types, required/optional, enums and their meanings, constraints, worked examples, and the version
- Schema annotations (`description`, `examples`) enriched at source where the reference needs prose, so documentation lives with the contract and cannot diverge
- A drift gate in the repo's discipline style: regenerate + `git diff --exit-code` (CI + gates table), same as the dataset freeze — a schema change without a regenerated doc fails the gate
- Hand-maintained duplicates re-pointed at the generated reference: `docs/shared-contracts.md` keeps its narrative and curated examples but links instead of duplicating field lists; the data-model-reference skill links likewise

## Capabilities

### New Capabilities

### Modified Capabilities

(skip_specs: repo tooling + docs automation, no product-capability spec — same pattern as other tooling/docs changes.)

## Impact

- **Code:** `packages/shared` (schema annotations), a generator script (`scripts/` or a tool workspace) + `pnpm` script, `docs/data-model.md` (generated, committed), `docs/shared-contracts.md` (dedupe), skill (link), CI workflow + `AGENTS.md` gates table (row addition — minimal edit to a security-sensitive file)
- **APIs / Dependencies:** generator runs on the TypeBox schemas as-is (they are JSON Schema); no runtime dependency changes expected
- **Docs:** the runbook/gates docs teach the regen command (commands-must-run-as-written)
- **Sequencing:** independent; lands best BEFORE the planned documentation review so the review validates generated output instead of hunting hand-drift

## Non-goals

- No schema changes beyond annotations; no replacement of the narrative contract doc; no runtime codegen
