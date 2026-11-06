# Tasks

## 1. Generator + gate (packages/shared, scripts, docs, CI)

- [x] 1.1 Build the model-doc generator (deterministic Markdown from the exported TypeBox schemas + SCHEMA_VERSION: field tables, types, required/optional, constraints, enum meanings from annotations, worked examples) behind a `pnpm docgen:model` script; verify it regenerates byte-identically for unchanged schemas (run twice, `git diff --exit-code`) and that every rendered claim matches its schema (spot-verified against Unit, UnitCard, and the envelope schemas)
- [x] 1.2 Enrich schema annotations at source where the reference needs prose (field meanings, honest-unknown semantics, enum semantics aligned with the glossary); generate and commit the first `docs/data-model.md`; verify the rendered output covers Unit, UnitCard, envelopes, and filters, and reads correctly for a new contributor
- [x] 1.3 Wire the drift gate: CI step + repo gates table row (`pnpm docgen:model` then `git diff --exit-code -- docs/data-model.md`), runbook command entry (commands run as written); verify the gate fails on a deliberate schema change without regeneration, and passes after regenerating
- [x] 1.4 Dedupe hand-maintained copies: `docs/shared-contracts.md` drops duplicated field lists in favor of links to the generated reference (narrative + curated examples stay; the doc-example mirror test updates to what it still legitimately covers); the data-model-reference skill links to the reference (prose-only edit); verify no doc now restates a field list the generator owns, and `pnpm -C packages/shared test` + the repo gates stay green

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
- Land BEFORE the planned documentation review so the review validates generated output rather than hunting hand-drift.
