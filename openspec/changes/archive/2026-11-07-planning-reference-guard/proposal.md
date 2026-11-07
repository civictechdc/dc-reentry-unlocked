# Proposal

## Why

Planning and doc prose references code and doc paths inside backtick code
spans, and nothing validates those references: `openspec validate`/`doctor`
check OpenSpec-internal structure only, `pnpm lint` covers
JS/TS/Svelte/JSON, and the repo's other reference surfaces all have
deterministic gates (datagen/docgen diff gates, `scripts/check-diagrams.mjs`,
the CI openspec gate) — prose file paths are the one unguarded surface.
Reference rot already shipped through it: the `honest-unknown-labels`
proposal cited `detail-values.ts` without its real location
(`apps/web/src/lib/components/`), and a one-way sequencing edge to
`taxonomy-label-parity` went unrecorded while `openspec doctor` reported
healthy. Standard link checkers cannot close this: they parse markdown
*link* syntax, and these references are code spans, invisible to them.

A throwaway measurement (2026-11-07; 106 markdown files, 613 backticked
path-like tokens: 489 resolved, 118 raw flags) shows the noise is tractable:
six rules (exclude `changes/archive/` as historical snapshot, skip
leading-`/` URL-route and absolute-path tokens, skip package/image refs
like `@scope/pkg` and `mcr.microsoft.com/...`, skip regex tokens,
resolution roots for app- and openspec-relative shorthand, skip
gitignored/conditional paths via `git check-ignore`) account for every raw
flag except three —
all three legitimately name files planned by in-flight changes
(`documentation-review`, `live-walkthrough-feedback`).

## What Changes

- Add `scripts/check-references.mjs` (same mold as
  `scripts/check-diagrams.mjs`): extract backticked path-like tokens from
  `README.md`, `AGENTS.md`, `docs/**/*.md`, and active
  `openspec/changes/**/*.md` (archive excluded); existence-check each with
  resolution roots (repo root, `apps/web/`, `openspec/`); apply the six
  skip/allow rules above
- Bare filenames (no slash): resolve against `git ls-files`; unique match
  passes, zero matches flags, multiple matches report as advisory only —
  never fail
- Escape hatch for planned-not-yet-landed files: an explicit allowlist
  entry with a reason (decision on inline-marker vs allowlist-file belongs
  to design)
- Wire into CI beside the openspec validate gate — report-only first
  (non-failing step); flip to strict (exit 1 on stale) after the three
  planned-file references land or get allowlisted
- Deterministic, greppable output (`file -> token` lines)

## Capabilities

### New Capabilities

### Modified Capabilities

(Dev tooling, no product spec-level behavior change — `skip_specs: true`,
expected to stay.)

## Impact

- **Code:** `scripts/check-references.mjs` (new, plain Node ESM, no deps),
  `.github/workflows/pr.yml` and `full.yml` (one report-only step each)
- **Docs:** one row in the worktree `AGENTS.md` verification-commands
  table once the check goes strict (report-only phase needs no row)
- **Sequencing:** independent of the ten domain-review follow-ups; the
  three outstanding planned-file references resolve when their own changes
  (`documentation-review`, `live-walkthrough-feedback`) land — allowlisted
  with reasons until then
