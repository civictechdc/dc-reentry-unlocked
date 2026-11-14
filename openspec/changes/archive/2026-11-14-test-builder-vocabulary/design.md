# Design

## Context

The shared test builders live in `packages/shared/src/testing/index.ts`
(392 lines, test-only subpath enforced by dep-cruiser). Three facts shape
this design (findings DM-8 / CO-9 in
`openspec/changes/archive/2026-11-06-domain-driven-review/domain-review.md`;
motivation in `proposal.md`):

- `aUnit()` returns a `UnitCardBuilder` — the card read model, not the
  `Unit` hierarchy leaf — and its defaults combine `bedrooms: 1` with
  `roomType: "efficiency"`, a combination the generator's own domain rule
  forbids (`tools/datagen/src/generate.ts` `pickBedrooms`: efficiency and
  shared rooms get 0 bedrooms, private rooms exactly 1, apartments ≥ 1).
- Every program policy field (6 `PolicyState` fields) costs four
  hand-written methods — `withX`/`withUnknownX` on `ProgramBuilder` plus
  the mirrored pair on `UnitCardBuilder` (~120 lines); the 4 unknownable
  program enums (housing type, length of stay, population, gender) repeat
  the same ×4 mirror (~64 lines). Forgetting a pair fails silently.
- The `Unit` entity has no builder, so `entities.test.ts` and
  `shared-contracts.test.ts` carry local `aUnitEntity` factories — both
  copying the invalid 1-bedroom-efficiency default. The card builder also
  cannot fluently set `applicationProcess`, program `name`, or provider
  contact fields (no fluent form exists today).

Call-site spread: ~90 `aUnit()` usages across `apps/web`, `apps/api`, and
`packages/shared` tests. Only ~10 chains set bedrooms explicitly; ~6
assertions in 3 files pin `bedrooms: 1` (two of the files are the ones
whose local factories retire here anyway).

Carry-over rider (recorded when `dataset-integrity` archived): the
structural helper in `tools/datagen/src/generate.test.ts` builds a
write-only `programIdsByProvider` map.

Constraints: no spec deltas (`skip_specs` stays — test-only change); the
`testing` subpath must remain importable only from test files; test style
doctrine requires domain-language fluency, not schema plumbing.

## Goals / Non-Goals

**Goals:**

- Fixture names that tell the truth: `aUnitCard()` builds cards, `aUnit()`
  builds the `Unit` entity.
- Defaults that never violate a domain rule the codebase itself states.
- Delegation growth contained: one data-driven table drives the mirrored
  fluent forms on both builders, with a schema-derived rot guard so a
  missing entry is a loud failure.
- A narrow generic escape hatch for fields that have no business carrying
  fluent vocabulary.

**Non-Goals:**

- No schema or runtime validation of the bedrooms↔roomType rule — that
  domain rule stays generator-side (datagen) and docs-side; `UnitSchema`
  and `UnitCardSchema` are unchanged.
- No spec deltas, no production-code changes, no e2e/Gherkin fixture work
  (the e2e layer drives live servers, not these builders).
- No builder API redesign beyond what DM-8/CO-9 require — `aProvider()` /
  `aProgram()` and the unit-level card vocabulary stay as they are.

## Decisions

### Decision 1 — naming split, clean rename (user call, 2026-11-13)

`aUnitCard()` / `UnitCardBuilder` for the card read model; a new
`aUnit()` / `UnitBuilder` for the `Unit` entity. No deprecated alias:
the `testing` subpath is a repo-internal test-only API, so a clean cut
with a mechanical rename is grep-verifiable and leaves no doubled
vocabulary. The reused `aUnit` name is safe against missed renames
because the entity builder lacks the program/provider fluent forms and
`build()` returns `Unit`, not `UnitCard` — stragglers fail typecheck,
not silently pass.

`UnitBuilder` mirrors the card builder's unit-level vocabulary
(`withId`, `inWard`, `inQuadrant`, `withExactAddress`, `withCoordinates`,
`withBedrooms`, `withRoomType`, `withSquareFeet`, `withCost`,
`available` / `unavailable` / `withUnverifiedAvailability`,
`needsVerification` / `confirmed`) plus `withProgramId`. Default
`programId: "program-test"` so `aUnit()` composes id-consistently with
`aProgram()` out of the box. The local `aUnitEntity` factories in
`entities.test.ts` and `shared-contracts.test.ts` retire.

Alternatives rejected: keeping a `aUnit` → card alias (preserves the lie
DM-8 names); building only the entity builder and leaving card sites on
the old name (same problem, half done).

### Decision 2 — default fixture becomes a domain-valid 0-bedroom efficiency (user call, 2026-11-13)

Card and entity builders default to `bedrooms: 0`, `roomType:
"efficiency"`, `squareFeet: 400` (inside the generator's efficiency range
[280, 480]). Builder defaults must never violate a rule the domain states
elsewhere; an invalid combination stays constructible — the schema permits
it — but only when a call site says so explicitly (e.g.
`.withBedrooms(1)`).

Per the user's note: the point of zero-bedroom defaults is that the
presentation vocabulary for rooms with beds stays visible — the
zero-bedroom presentation tests (efficiency → Studio vocabulary,
shared-room → bed-available vocabulary) remain explicit call sites and
must survive the churn. Relying `bedrooms: 1` assertions (~6 sites, 3
files) either pin the combination explicitly or flip their expectation to
the honest default; typecheck + tests catch every break, so nothing
migrates silently.

Alternative rejected: keep the invalid default and make each relying call
site explicit — zero churn, but every future test inherits a dishonest
default by omission.

### Decision 3 — CO-9: both mechanisms, data-driven table primary (user call, 2026-11-13)

**Primary — data-driven delegation over one field table.** A single
table in the testing module lists each delegable program field: field
name, fluent stem (`"ReferralPolicy"` → `withReferralPolicy` /
`withUnknownReferralPolicy`), accepted value type, and unknown literal.
A small install helper attaches the `withX`/`withUnknownX` pair to
BOTH `ProgramBuilder` (sets the field) and `UnitCardBuilder` (delegates
to its embedded `ProgramBuilder`) from that one table. Coverage:

- the 6 `PolicyState` fields (CO-9's exact finding), and
- the 4 unknownable program enums (housing type, length of stay,
  population, gender), which repeat the identical ×4 mirror pattern —
  folding them in deletes ~180 lines behind one mechanism rather than
  leaving a half-migrated seam.

Public typing stays fully fluent and compiler-verified via a
hand-written shared interface (method per fluent form, polymorphic
`this` returns) that both classes `implements`: the compiler proves the
runtime installation is complete against the declared surface. Growth
per new policy field becomes one table entry + one interface line pair,
and the UnitCardBuilder mirror comes free.

**Rot guard (the actual fix for "fails silently").** A test derives the
expected policy-field set from `ProgramSchema` itself — properties whose
type is `PolicyState` (identity match, structural fallback matching the
enum to `POLICY_STATES` if the schema wraps it) — and asserts the table
covers exactly that set, both directions. A second table-driven test
exercises every entry's installed methods on both builders (set a value,
set unknown). A new policy field without a table entry therefore fails a
named test, not a code-review memory.

**Escape hatch — `withProgram(partial)` / `withProvider(partial)` on the
card builder.** One generic method each, taking `Partial<Program>` /
`Partial<Provider>` and merging into the embedded builder. This fills
present-day gaps, not speculative ones: `applicationProcess`, program
`name`, and provider contact fields have no fluent form on the card
builder today. Doctrine line, stated in the module docblock: fluent forms
are the vocabulary for domain-meaningful fields; the escape hatch is for
schema plumbing and for fields that have not earned a table entry yet.
It is never the default idiom in review.

Alternatives rejected: `withProgram(partial)` alone (call sites become
schema plumbing — `withProgram({ sobrietyRequired: "unknown" })` — which
the test-style doctrine forbids, and ~90 fluent call sites would read
worse or stay duplicated); Proxy-based builders (lose typed
discoverability); generating the interface itself from mapped/template
literal types (polymorphic-`this` in intersections is fragile across the
repo's two TypeScript compilers — `tsc` for shared/api/datagen, `tsc6`
for web — for no line-count win over the thin hand-written interface).

### Decision 4 — the datagen carry-over rides here

The write-only `programIdsByProvider` map in
`tools/datagen/src/generate.test.ts` is removed (or wired to the check it
was evidently meant to feed — the read it implies, units resolving to a
program under the same provider, already exists as the
`program.units.every(...)` assertion). Test-only, one file, recorded as
this change's rider when `dataset-integrity` archived.

## Risks / Trade-offs

- [Runtime-installed prototype methods are invisible to tooling that only
  reads source] → the `implements` interface is the compile-time surface;
  the install helper is the single contained cast site; `pnpm typecheck`
  exercises both compilers and `pnpm lint`/`format:check` run on the
  module like any other.
- [Schema-derived rot guard breaks if `ProgramSchema` later wraps policy
  fields (optional, nullable)] → structural fallback matches the property
  enum to `POLICY_STATES`; failure output lists the expected/actual diff
  so the next entry is mechanical.
- [Escape hatch overuse re-introduces schema-plumbing test bodies] →
  docblock doctrine + review attention; the rot guard keeps the fluent
  set complete so the hatch has no correctness excuse.
- [Default flip changes meaning for tests that relied on `bedrooms: 1`
  silently] → impossible to miss: ~6 enumerated assertion sites, plus
  typecheck/test gates; zero-bedroom presentation coverage (Studio,
  bed-available) is preserved as explicit call sites per Decision 2.
- [Renamed `aUnit` reuse could mask a missed card call site] → the entity
  builder's missing program/provider forms and `Unit`-typed `build()`
  turn any straggler into a type error; the rename is additionally
  grep-verifiable.
- [Two delegation mechanisms coexist] → accepted trade-off (Decision 3):
  each has present-day work; the table is authoritative for everything
  domain-meaningful.

## Migration Plan

Single change, test-only; no deploy or data implications. Order keeps
every intermediate state green:

1. Extend the testing module: field table + install helper + typed
   interface, `UnitBuilder`/`aUnit()`, escape-hatch methods, module
   docblock doctrine line; add the rot-guard and table-driven tests for
   the module (a test file importing the `testing` subpath — allowed,
   test files may import it).
2. Mechanical rename `aUnit(` → `aUnitCard(` across test call sites;
   retire the two local `aUnitEntity` factories in favor of the real
   builder.
3. Flip the default to the 0-bedroom efficiency on both builders; fix
   the enumerated relying assertions (pin explicitly or expect the
   honest default), keeping the zero-bedroom presentation tests intact.
4. Remove the dead `programIdsByProvider` map in
   `tools/datagen/src/generate.test.ts`.
5. Full gates from the worktree root: `pnpm lint`, `pnpm format:check`,
   `pnpm test`, `pnpm typecheck`, `pnpm arch:check` (covers the testing
   subpath rule), `openspec validate --all --strict`.

Rollback: single `git revert`; no runtime, contract, or dataset surface
is touched.
