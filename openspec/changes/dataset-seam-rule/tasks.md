# Tasks

## 1. Re-arm the dataset seam rule

- [x] 1.1 Change the `to` pattern of `api-route-must-not-read-dataset-directly` in `.dependency-cruiser.cjs` from `(^|/)data/units\.v\d+\.json$` to `(^|/)data/units\.json$` (design D1); verify `pnpm arch:check` still exits 0 — no false positives on current code
- [x] 1.2 Add `scripts/arch-rules.test.mjs` to the repo-tool suite: it loads `.dependency-cruiser.cjs` (no re-declared patterns), finds the rule by name, and asserts (a) its `to.path` (string or array) matches at least one real file under `data/`, (b) its `from.path` matches at least one real file under `apps/api/`, and (c) `apps/api/src/datasource.ts` matches `from.pathNot` (design D2/D3); verify via `pnpm exec vitest run scripts/arch-rules.test.mjs` with behavioral-sentence test names, and verify the test fails loudly when the `to` pattern is temporarily re-rotted (restore afterward)

## 2. Gate verification

- [x] 2.1 Run the repo gates from the root — `pnpm lint`, `pnpm format:check`, `pnpm exec vitest run` (full repo-tool suite), `pnpm arch:check` — and verify all exit 0

## Workflow follow-up

- Orchestrator commits after review (implementers never commit).
- Archive the change after review requirements are satisfied (`/opsx-archive`).
