# Design

## Context

The frozen dataset has been `data/units.json` since the schema-version 0.2
rename; the dep-cruiser rule `api-route-must-not-read-dataset-directly`
still matches `(^|/)data/units\.v\d+\.json$`, so the rule's match set is
empty and it guards nothing. dependency-cruiser does not report a forbidden
rule whose match set is empty — the seam disarms silently. See
`proposal.md` and the domain review (finding CO-1, product decision
2026-11-06: split out, land fast) for motivation.

Current-state facts the design relies on (verified in-repo):

- `.dependency-cruiser.cjs` is a CommonJS `module.exports` with a
  `forbidden: [...]` array; each rule's `path`/`pathNot` fields are
  regex-source strings, cwd-relative to the repo root, forward slashes.
- `data/` currently holds `units.json` plus `geography/{wards,streets,zips}.json`.
- The rule's `from` side targets `^apps/api/` with `pathNot: "[Dd]ata[Ss]ource"`;
  the DataSource module is `apps/api/src/datasource.ts` (matched by `pathNot`).
- The repo-tool suite is the root vitest config, which includes
  `scripts/*.test.mjs` and `scripts/agent-hooks/*.test.mjs`.

## Goals / Non-Goals

**Goals:**

- Re-arm the ingestion-pipeline seam: the rule matches the dataset file
  that actually exists today.
- Make the next silent disarm impossible: a test fails loudly when the
  rule stops matching real files under `data/`.

**Non-Goals:**

- No change to the DataSource module, API routes, or any runtime code.
- No broadening of the rule to all of `data/` (the seam rule is about the
  units dataset; `data/geography/**` stays out of scope).
- No new dependency; the test uses Node's stdlib plus vitest.

## Decisions

**D1 — Exact-path `to` pattern, not a version-tolerant one.**
Replace with `(^|/)data/units\.json$`. Alternative considered:
`(^|/)data/units(\.v\d+)?\.json$` — rejected: it encodes dead naming
history and re-opens the exact rot window this change closes (a future
rename to a third shape would again match nothing). The pattern should
state the current contract exactly; the rot-guard test, not pattern
tolerance, provides continuity across renames.

**D2 — Rot-guard test loads the real config; never re-declares patterns.**
New `scripts/arch-rules.test.mjs` (repo-tool suite) `require`s
`.dependency-cruiser.cjs`, finds the rule by name, compiles its
`to.path` (string or array of strings — handled both ways), walks the
actual `data/` tree, and asserts at least one real file matches. The test
duplicates no regex text; the config stays the single source of truth.
A green test proves the rule is armed; a dataset rename flips it red and
the failure message names the stale pattern and the actual files.

**D3 — Assert the `from` side is armed too (same failure mode, mirrored).**
An empty `from` match set disarms the rule just as silently as an empty
`to` match set. The same test also compiles `from.path` and asserts at
least one real file under `apps/api` matches, and that the DataSource
module (`apps/api/src/datasource.ts`) still matches `from.pathNot`.
Three extra lines that close the whole failure-mode class, not just the
observed instance. Alternative considered: `to`-side only (proposal's
literal text) — rejected as knowingly leaving the mirrored hole open.

**D4 — Specs stay skipped (`skip_specs` kept).**
This change alters no capability behavior: it is dev-environment
tooling (config + test), self-enforcing through `pnpm arch:check` and the
repo-tool suite. The proposal deferred this call to planning; decided
here — no delta spec. The enforcement itself is the deliverable.

## Risks / Trade-offs

- [Rule turns false-positive after the fix] → `pnpm arch:check` must stay
  green on current code; the DataSource `pathNot` exemption is asserted
  by the rot-guard test (D3), not assumed.
- [Rot-guard drifts from dep-cruiser's resolution semantics] → the test
  deliberately checks regex-vs-path arming (does the rule match real
  files), not full cruise resolution; full semantics stay covered by
  `pnpm arch:check` itself, which the task block runs.
- [Test walks `data/` recursively] → dataset growth (more `data/` files)
  is fine; the assertion is "at least one match", so additions cannot
  break it, only a total mismatch can.
