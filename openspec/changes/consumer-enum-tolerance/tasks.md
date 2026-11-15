# Tasks

## 1. Shared — tolerant intake schema

- [x] 1.1 Add `UnitsResponseIntakeSchema` to `packages/shared` (envelope shape identical to `UnitsResponseSchema`; each taxonomy field widened to a non-empty string; `minLength(1)` guard), export it from the package index. Verify: `pnpm -C packages/shared typecheck` and shared test suite pass.
- [x] 1.2 Pin the strict/tolerant split in shared tests: a future taxonomy value (e.g. `rapid-rehousing`) passes the intake schema and fails `UnitsResponseSchema`; existing extra-field tolerance tests (`entities.test.ts`, `unit-card.test.ts`) stay green. Verify: `pnpm -C packages/shared test`.
- [x] 1.3 If the intake schema appears in the generated model reference, regenerate it and commit the result. Verify: `pnpm docgen:model` then `git diff --exit-code -- docs/data-model.md` is clean.

## 2. Web — intake switch + future-value rendering

- [x] 2.1 Switch `client.ts#units` validation to `UnitsResponseIntakeSchema` (error path unchanged). Add a client test: an envelope carrying a future taxonomy value is accepted, not thrown away. Verify: `pnpm -C apps/web test` (client tests).
- [x] 2.2 Add the future-value branch to `detail-values.ts`: a value outside the known vocabulary and not `unknown`/`yes`/`no` renders a humanized form of the raw value; the `?? detail_value_unknown()` fallback becomes unreachable for taxonomy fields; widen the parameter type. Verify: `detail-values.test.ts` covers future, known, and unknown values.
- [x] 2.3 Card and detail render tests: a future housing type renders its derived presentation on card and detail rows and never the "Unknown" message; known-value label tests unchanged byte-for-byte. Verify: `UnitCard.test.ts`, `DetailSlideOver.test.ts`, `UnitCardList.test.ts`.

## 3. Docs — the two-schema posture

- [x] 3.1 Add a `docs/shared-contracts.md` example: strict contract (producer/OpenAPI truth) vs tolerant consumer intake (non-empty-string enums), plus the two-unknown rule with the DM-2 provenance phrasing. Verify: doc renders with no dead references; `pnpm format:check` clean.

## 4. Integration gates

- [x] 4.1 Full deterministic gate run from the repo root: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, `openspec validate --all --strict`. Verify: all green.
