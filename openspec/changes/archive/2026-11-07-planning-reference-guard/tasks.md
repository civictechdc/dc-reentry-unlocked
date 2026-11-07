# Tasks

## 1. Extractor script

- [x] 1.1 Implement `scripts/check-references.mjs` per design.md decisions
      1–7: backtick-span extraction, skip rules (leading `/`, packages,
      registries, regex metachars, globs, command prefixes), resolution
      roots (repo root → `apps/web/` → `openspec/`), bare-filename
      `git ls-files` resolution (unique pass / zero flag / multi advisory),
      `PLANNED` allowlist with reasons, `--report-only` flag, sorted
      `file -> token` output; zero dependencies
- [x] 1.2 Self-check against the current tree: flags reduce to the three
      known planned-file references (all covered by `PLANNED` entries
      naming `documentation-review` / `live-walkthrough-feedback`) plus
      advisory-only ambiguous names; no unexplained stale flag

## 2. Tests

- [x] 2.1 Add a fixture-driven test to the repo-tool suite (Vitest):
      temp tree with known ok / stale / bare-unique / bare-ambiguous /
      planned-allowlisted / rule-skipped tokens; assert exit codes,
      flag lines, and advisory separation (strict and `--report-only`
      modes)

## 3. CI wiring

- [x] 3.1 Add one report-only step to `.github/workflows/pr.yml` and
      `full.yml` beside the openspec validate step
      (`node scripts/check-references.mjs --report-only`); no other
      workflow changes

## 4. Verification

- [x] 4.1 Full deterministic gate run from the repo root passes:
      `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`,
      `pnpm arch:check`, `openspec validate planning-reference-guard --strict`
