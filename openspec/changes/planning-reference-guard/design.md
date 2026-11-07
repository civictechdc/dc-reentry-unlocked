# Design

## Context

See proposal.md — Why. The measurement (106 files, 613 tokens, 118 raw
flags → 3 real after rules) is the evidence base; the extractor rules below
are those six rules made executable. The script follows
`scripts/check-diagrams.mjs`: plain Node ESM, zero dependencies,
deterministic output, run from the repo root.

## Goals / Non-Goals

- **Goals:** existence-check backticked path references in `README.md`,
  `AGENTS.md`, `docs/**/*.md`, active `openspec/changes/**/*.md`; zero
  false failures on the current tree; report-only CI first.
- **Non-Goals:** markdown *link* syntax checking (no gap — standard tools
  exist if ever wanted); URL/HTTP liveness; `.agents/skills/**` content
  (upstream-verbatim, not ours to fix); semantic staleness (right path,
  wrong claim is undetectable); `openspec/changes/archive/**` (historical
  snapshot — fixing it rewrites history).

## Decisions

1. **Token scope: backtick code spans only.** The gap is prose code spans;
   links are syntactic and already tool-checkable. Extraction regex:
   `` /`([^`\n]+)`/g ``.
2. **Path-like test:** token contains `/` or matches a known-extension
   list (`ts js mjs cjs svelte json md yaml yml toml sh css html txt sql`).
   Skip before testing: leading `/` (URL routes, absolute paths, `/opsx-*`
   commands), `@scope/` packages, registry hosts (`mcr.` etc.), URL
   schemes (token contains `://`), regex
   metachars (`\d ^ $ + ?`), glob/placeholder chars (`* < > { } $ ~`),
   whitespace, command prefixes (`pnpm npm npx node bunx git openspec docker`),
   and the `.git/` prefix (git special-cases it; `git check-ignore` never
   matches it).
3. **Resolution roots, first hit wins:** repo root → `apps/web/` →
   `openspec/`. Covers `e2e/perf.spec.ts` and `changes/`-style shorthand
   the measurement found.
4. **Bare filenames:** basename match against `git ls-files`. Exactly one
   match → pass; zero → flag; multiple → advisory line, never fail
   (`tasks.md`, `package.json` are legitimately ambiguous).
5. **Escape hatch: allowlist constant inside the script** —
   `PLANNED = { "<path>": "<reason>" }`; reasons must not name OpenSpec
   changes (repo rule: no OpenSpec-internal tracking references in
   committed files outside `openspec/`) — "planned, not yet landed"
   wording; an entry is removed when its path lands. Gitignored /
   machine-conditional paths are NOT allowlisted: they are rescued
   mechanically by one batched `git check-ignore --stdin` pass over stale
   candidates only. Keys ending in `/` are directory prefixes: they pass
   every path under that directory. Alternatives rejected: inline prose markers (litter
   the doc, rot after the file lands, accumulate silently); separate
   config file (new format + new drift surface for a three-entry list).
   Revisit if the list passes ~10 entries.
6. **CI: `--report-only` flag** (exit 0, full output) — in `pr.yml` beside
   the openspec validate gate; in `full.yml` inside the `determinism` job
   (that workflow has no openspec step to sit beside). Strict mode
   (exit 1 on stale) is a later flip after the three current planned-file
   refs land or allowlist — not part of this change's CI wiring.
7. **Determinism:** sorted output, no timestamps, `file -> token` lines —
   diffable, greppable, CI-log friendly.

## Risks / Trade-offs

- [False positives erode trust] → every rule is measurement-derived;
  advisory tier can never fail the build; allowlist reasons reviewed in PR.
- [Allowlist becomes a junk drawer] → every entry needs a lifecycle
  reason and dies when its path lands (plus a landed-entry advisory, once
  implemented); strict-mode flip requires an empty (or justified) list.
- [Ignore-rescue trusts PR-editable `.gitignore`] → harmless while
  report-only; the later strict-flip change must treat `.gitignore` edits
  in the same PR as gate-neutralizing and review them accordingly.
- [Extractor misses non-backtick references ("its caller")] → accepted;
  prose beyond code spans is out of scope by design.

## Migration Plan

Land report-only (zero behavior change for anyone). Strict flip later:
empty the allowlist, drop `--report-only`, add the `AGENTS.md`
verification-table row — that flip is its own small change.

## Open Questions

None blocking.
