# Tasks

## 1. Spec-delta verification

- [x] 1.1 Confirm the change is spec-only: `git status --porcelain` from the worktree root shows no modified or untracked paths outside `openspec/changes/mobile-initial-tab/`, and diffing the delta's MODIFIED block against `openspec/specs/housing-search-ui/spec.md` shows exactly one changed line (the reworded scenario THEN)
- [x] 1.2 Re-confirm shipped map-first behavior at phone width against a fresh dev boot (stop stray servers first) — at a 390x844 viewport the Map tab is the selected tab and the map view renders before any interaction; record the observation in the session
- [x] 1.3 Run the gates from the worktree root — `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, `pnpm design:check` — and `openspec validate mobile-initial-tab --strict`; verify every command exits 0 and record the results before review

## Workflow follow-up

- Orchestrator commits after the review gates pass (implementers never commit).
- Archive via the archive workflow after review; it integrates the delta into the main spec.
