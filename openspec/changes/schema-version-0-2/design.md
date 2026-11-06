# Design

## Context

`SCHEMA_VERSION = "2.0"` (primitives.ts) is the single source: schemas carry
it via `Type.Literal(SCHEMA_VERSION)`, the dataset embeds it top-level, the
API loader asserts it at boot (throws on mismatch), datagen stamps it. The
frozen file name `units.v2.json` has tracked the version since the v1→v2
rename. ~15 test literals and a handful of docs/skill lines hardcode "2.0".
History prose names the old version ("removed in schema version 2.0").

## Decisions

**D1 — Value `"0.2"`, two segments, exact-literal semantics unchanged.**
Preserves the revision lineage (2nd contract revision, now honestly pre-1)
without inventing a third segment. Consumers are `Type.Literal` exact-match;
no numeric parsing exists anywhere. Alternative: `"0.1"` — rejected, it
erases the revision count the lineage already encodes.

**D2 — Example annotations cite the constant, not the literal.** The UnitCard
and ErrorEnvelope `examples` annotations switch their `schemaVersion` value
to `SCHEMA_VERSION` so regeneration can never drift from the constant.
Alternative: keep literals — rejected, that is the drift the docgen change
just eliminated elsewhere.

**D3 — Dataset filename loses version branding (`units.json`).** With 0.x the
major stays 0 across breaking minors, so `units.v{version}.json` renames
file + loader + Dockerfile + docs on every bump for zero information: the
loader's boot-time content assert (dataset.schemaVersion !== SCHEMA_VERSION →
throw) already guarantees the file matches the contract. Revisit at
confirmation time (a 1.x file could re-adopt `units.v1.json` branding).

**D4 — History prose goes date-based.** "Removed in schema version 2.0"
becomes "removed in the 2026-10-31 revision" — the repo's preferred
provenance style, and it cannot go stale on the next version change.

## Risks / Trade-offs

- [Pre-1 optics] 0.x tells consumers "expect breaks" — that is the intent,
  not a cost, while the model is unconfirmed.
- [Rename blast radius] One-time mechanical sweep (datagen, loader,
  Dockerfile, docs, AGENTS.md); the byte-identical regen gate and the loader
  assert keep it honest afterward.
