# Tasks

## 1. Testing-module vocabulary and delegation table

- [x] 1.1 Add the delegable-field table, install helper, and hand-written shared fluent interface so one table entry installs the `withX`/`withUnknownX` pair on both `ProgramBuilder` (sets the field) and `UnitCardBuilder` (delegates to its embedded `ProgramBuilder`), covering the 6 `PolicyState` fields and the 4 unknownable program enums, and verify a new table-driven module test exercises every entry's pair on both builders
- [x] 1.2 Add `UnitBuilder` / `aUnit()` mirroring the card builder's unit-level vocabulary plus `withProgramId` (default `programId: "program-test"` so it composes with `aProgram()` out of the box), and verify a module test builds a `Unit` fluently via the `testing` subpath import
- [x] 1.3 Add the `withProgram(partial)` / `withProvider(partial)` escape hatches on the card builder and the module docblock doctrine line (fluent forms are the vocabulary for domain-meaningful fields; the hatch is for schema plumbing and fields without a table entry yet), and verify module tests set `applicationProcess`, program `name`, and provider contact fields through the hatch
- [x] 1.4 Add the schema-derived rot guard: derive the expected policy-field set from `ProgramSchema` itself (identity match on `PolicyState`, structural fallback matching the property enum to `POLICY_STATES`) and assert the table covers exactly that set in both directions with diff-friendly failure output, and verify the guard fails loudly by temporarily removing one table entry, then restoring it

## 2. Call-site rename and factory retirement

- [x] 2.1 Rename `aUnit(` → `aUnitCard(` mechanically across test call sites in `apps/web`, `apps/api`, and `packages/shared`, and verify `pnpm typecheck` passes (a straggler fails typecheck: the entity builder lacks the program/provider fluent forms and `build()` returns `Unit`)
- [x] 2.2 Retire the local `aUnitEntity` factories in `entities.test.ts` and `shared-contracts.test.ts` in favor of the real `aUnit()` builder, and verify both suites pass

## 3. Honest default flip

- [x] 3.1 Flip card and entity builder defaults to `bedrooms: 0`, `roomType: "efficiency"`, `squareFeet: 400` (inside the generator's efficiency range), then fix each enumerated relying assertion — pin the combination explicitly or flip the expectation to the honest default — keeping the zero-bedroom presentation tests (efficiency → Studio vocabulary, shared-room → bed-available vocabulary) intact as explicit call sites, and verify `pnpm test` and `pnpm typecheck` pass

## 4. Datagen carry-over rider

- [x] 4.1 Remove the write-only `programIdsByProvider` map in `tools/datagen/src/generate.test.ts` (the read it implies — units resolving to a program under the same provider — already exists as the `program.units.every(...)` assertion), and verify the datagen suite passes

## 5. Integration gates

- [x] 5.1 From the worktree root run `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check` (covers the testing-subpath rule), and `openspec validate --all --strict`, and confirm all green

## Workflow follow-up

- Review gates before commit: code review, security review, adversarial review (orchestrator-run; implementers never commit).
- Archive the change with `/opsx-archive` after reviews pass and the user confirms.
