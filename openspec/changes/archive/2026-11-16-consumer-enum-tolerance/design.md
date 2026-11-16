# Design

## Context

See proposal.md — Why (DM-2: the consumer-tolerance promise binds; a future
enum value must never render as the honest-unknown marker).

Current state that shapes the approach:

- Every eligibility enum in `packages/shared/src/program.ts` is a closed
  union (`taxonomy | "unknown"`). That file is the API contract's single
  source of truth and stays strict.
- `apps/web/src/lib/api/client.ts` validates the whole `/units` envelope
  with `Value.Check(UnitsResponseSchema, …)` and throws on nonconformance —
  a future taxonomy value kills the entire units fetch, not just one card.
- `apps/web/src/lib/components/detail-values.ts` is the single render seam
  for taxonomy labels (card rows + detail panel share it). Its fallback
  `taxonomyMessages[value] ?? m.detail_value_unknown()` is where a future
  value would conflate with the honest unknown — no other web code switches
  over taxonomy unions.
- Evolution tests today cover extra *fields*
  (`entities.test.ts`, `unit-card.test.ts`), not future enum values.
- Binding constraint (domain review, product decision 2026-11-06): a value
  newer than the consumer's vocabulary and a fact the source does not
  publish are different unknowns and must not conflate.
- The schema-version 0.2 reset stands; DM-2 is enum evolution, not
  versioning — no schemaVersion bump.

## Goals / Non-Goals

**Goals:**

- Tolerant consumer intake: a `/units` payload carrying a future taxonomy
  value passes web intake; the unit renders.
- Two-unknown distinction end-to-end: future values render a presentation
  derived from the published value, never the honest "Unknown".
- Producer-side strictness untouched: the API contract, dataset validation,
  and OpenAPI truth stay exactly as strict as today.
- Evolution tests extended from extra fields to future enum values.

**Non-Goals:**

- Loosening producer/API-side validation anywhere (tolerance is a
  consumer-intake concern — proposal binding).
- `/filters` payload intake tolerance (target membership) — that is
  `filter-target-semantics` (DM-3). The two changes touch disjoint client
  files: this one `client.ts#units` + `detail-values.ts`; that one
  `filters-response.ts` + `query.ts`.
- Filter *matching* semantics for future values: matching happens API-side
  where values are current for the producer; nothing to tolerate.
- A schemaVersion bump or any served-contract change.
- Localized message-catalogue entries for future values (impossible by
  definition — humanization is structural, not per-value translated).

## Decisions

### D1 — Tolerant intake schema variant in `packages/shared`, strict contract untouched

Add `UnitsResponseIntakeSchema`: same envelope shape (`schemaVersion`,
`synthetic: true`, `disclosure`, `units` array of cards) with each taxonomy
field widened from `taxonomy | "unknown"` to a non-empty string. The
canonical `UnitsResponseSchema` stays the contract truth (API validation,
OpenAPI, docgen).

Alternatives considered:

- *Relax the canonical schema* — rejected: producer-side validation stays
  strict (proposal binding); the served contract keeps its enumerated
  documentation value.
- *Web-local schema copy* — rejected: forks the contract seam
  (`packages/shared` is THE API contract); drift risk.
- *Check-strict-then-patch per field* — rejected: no schema to validate the
  patched shape against; ad-hoc field walking re-implements validation.

Why non-empty string rather than a branded future type: at intake the
consumer cannot distinguish a future value from any other string, and does
not need to — the render seam derives presentation from the value itself.
`minLength(1)` guards the empty-string degenerate.

### D2 — Web client switches `/units` validation to the intake schema

`client.ts#units` validates against `UnitsResponseIntakeSchema`; error
path unchanged (envelope mismatch still throws `ClientError`). `/filters`
handling is untouched (DM-3 scope).

### D3 — Render seam gains an explicit future-value branch

`detailValueLabel` in `detail-values.ts`: a value that is not
`"unknown"`/`"yes"`/`"no"` and not in `taxonomyMessages` renders a
humanized form of the raw value (slug → spaced, capitalized words —
`rapid-rehousing` → "Rapid rehousing"). The `?? m.detail_value_unknown()`
fallback becomes unreachable for taxonomy fields. Known-value labels and
the honest-unknown marker are byte-identical to today (pinned by existing
tests).

Why humanize the raw value rather than a generic marker message: the
published value is truthful, self-describing information; a generic
"newer option" marker would hide it. Distinctness from "Unknown" is the
only binding requirement (DM-2 resolution); humanization satisfies it
without inventing copy per value.

### D4 — Type posture: strict Static types stay canonical; intake types widen

The closed TS unions (`HousingType` etc.) remain the producer-side types.
The intake schema's Static types are string-based; `detailValueLabel`'s
parameter widens accordingly. No cascade: the render seam is already a
string-keyed lookup, and no other web code switches over the unions.

### D5 — Testing: pin the strict/tolerant split; simulate future values in tests only

Shared: a future taxonomy value (e.g. `rapid-rehousing`) PASSES
`UnitsResponseIntakeSchema` and FAILS `UnitsResponseSchema` — pinning both
halves of the split. Existing extra-field tolerance tests stay green.
Web: client accepts an envelope carrying a future value; card and detail
render the humanized presentation and never the unknown message.
Dataset/datagen untouched — the scenario "consumer older than the contract
revision" is constructed in tests, not by shipping a new taxonomy value.

### D6 — Docs: the two-schema posture and the two-unknown rule

`docs/shared-contracts.md` gains an example covering the strict-contract
vs tolerant-intake posture and the two-unknown rule. If the intake schema
lands in the generated model reference, `pnpm docgen:model` is regenerated
and committed (byte-identity gate then clean).

## Risks / Trade-offs

- [Intake accepts malformed enum strings — garbage renders humanized] →
  producer validation stays strict, so garbage only appears on contract
  violation; rendering the published value is truthful either way;
  `minLength(1)` guards empty strings.
- [Humanized copy is unvetted by the walkthrough audience] → same vetting
  path as the honest-unknown marker copy (`honest-unknown-labels`, pending
  walkthrough vetting); only casing/spacing rules are choices, and they are
  test-pinned once written.
- [Widening the render parameter weakens type-directed exhaustiveness] →
  single seam (`detail-values.ts`); known branches keyed off exact
  literals; existing label tests pin known values byte-identical.
- [docgen drift when a schema is added] → regeneration + byte-identity
  gate (`git diff --exit-code -- docs/data-model.md`) catches it.

## Open Questions

- Exact humanization rules (title-case vs sentence-case, hyphen handling
  for acronyms) — deferrable to implementation review; does not change the
  specs, the approach, or the task breakdown. Copy follows the
  walkthrough-vetting path already established.
