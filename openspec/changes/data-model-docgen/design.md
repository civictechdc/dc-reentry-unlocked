# Design

## Context

`packages/shared` holds the contract as TypeBox (= JSON Schema): Unit,
UnitCard, envelopes, filter schemas, SCHEMA_VERSION. Hand-maintained
descriptions live in `docs/shared-contracts.md` (field lists + examples,
mirrored by `packages/shared/src/shared-contracts.test.ts`) and the
`.agents/skills/data-model-reference` skill. The OpenAPI route already
derives machine docs from the same schemas (with a drift test) — the
pattern works; the human-facing model reference just isn't generated.

## Decisions

**D1 — Generate from the schemas, nothing else.** The generator walks the
exported TypeBox schemas and SCHEMA_VERSION and emits Markdown: per-schema
field tables (type, required/optional, constraints, enum values with
glossary-aligned meanings), worked examples, and the version header. No
second source of truth, no hand-editable regions in the generated file
(header states it is generated and names the command).

**D2 — Prose comes from schema annotations.** Where the reference needs
explanatory prose (what a field means, honest-unknown semantics), add
`description`/`examples` to the SCHEMA — the doc renders them. Enrichment
happens at source, once, and every future regeneration carries it.

**D3 — Drift gate, datagen-style.** `pnpm docgen:model` regenerates;
`git diff --exit-code -- docs/data-model.md` proves sync. Wire into CI
alongside the dataset freeze gate and the repo gates table
(commands-must-run-as-written applies).

**D4 — Dedupe, don't duplicate.** `docs/shared-contracts.md` keeps the
narrative (contract philosophy, versioning rule, curated example walk) and
LINKS to the generated reference for systematic field lists — removing the
duplicated lists that task-by-task hand-edits kept rotting. The
data-model-reference skill links likewise (stays prose-only, a
security-sensitive agent-surface file).

**D5 — Deterministic output.** Stable key ordering, no timestamps, no
environment reads — regeneration is byte-identical for unchanged schemas
(the diff gate depends on it).

## Risks / Trade-offs

- [Generator scope creep] Rendering only what the schemas express keeps the
  generator small; glossary-level narrative stays in human docs (D4).
- [CI cost] Negligible — one script over a few schemas.
