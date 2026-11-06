# Tasks

## 1. Version swap + dataset rename + follow-through

- [x] 1.1 Swap the contract version at source: `SCHEMA_VERSION` → `"0.2"` (primitives.ts); point the UnitCard and ErrorEnvelope example annotations at `SCHEMA_VERSION` instead of the `"2.0"` literal; update the hardcoded `"2.0"` test literals (shared: shared-contracts.test, docgen render.test incl. the `const` assertion; api: app, filters, errors, cors-preflight, units tests); verify `pnpm -C packages/shared test` and `pnpm -C apps/api test` are green
- [x] 1.2 Rename and regenerate the frozen dataset: datagen output path → `data/units.json` (cli.ts, generate.ts comment, generate.test.ts), `git mv data/units.v2.json data/units.json`, update the API dataset loader path (datasource.ts) and the api Dockerfile COPY, update the filename in AGENTS.md, docs (architecture.md diagram + text, data-synthetic.md, api.md, runbook.md); verify `pnpm datagen` regenerates the renamed file with `schemaVersion: "0.2"` embedded and `git diff --exit-code -- data/` is clean on a second run, and the API boots against the renamed file (dev boot or compose healthcheck reaches healthy)
- [x] 1.3 Reword version-history prose to date-based provenance (primitives.ts Coordinates description + JSDoc "removed in schema version 2.0", shared-contracts.md "currently 2.0" + "version 2.0 removed", api.md, data-model-reference skill line) and regenerate `docs/data-model.md` (`pnpm docgen:model`) so it renders 0.2; verify the doc drift gate (`git diff --exit-code -- docs/data-model.md` after regen) and grep the repo for stray `"2.0"`/`units.v2` references outside openspec archives and git history
- [x] 1.4 Run the full gate battery: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, `node scripts/check-diagrams.mjs`, `openspec validate --all --strict` — all green from the worktree root

## Workflow follow-up

- After all tasks complete: code review per project policy, resolve findings,
  then archive this change and verify the archived specs.
