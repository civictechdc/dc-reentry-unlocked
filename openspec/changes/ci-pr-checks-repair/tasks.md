# Tasks

## 1. Repair the PR-check workflow

- [x] 1.1 Make a fresh checkout typecheck: add the Paraglide compile step (or an equivalent documented codegen invocation) before the web typecheck in `pr.yml`, and audit `full.yml`'s typecheck path for the same gap — the generated `apps/web/src/lib/paraglide/` tree is gitignored, which is why `svelte-check` failed on `#lib/paraglide/server.js` in the first-ever PR-check run; verify by a PR-check run whose "Typecheck" job is green on a clean runner (no cached generated code)
- [x] 1.2 Repair the Firefox e2e leg: every `desktop-firefox` spec in the Compose e2e matrix times out including retries (chromium and webkit green; first exposure run 42460002862 job 128667132599, `full.yml` has never run) — find the actual root cause (firefox launch inside the Compose matrix, playwright firefox dependencies on ubuntu-24.04, or otherwise) and fix it; if Firefox-in-Compose proves genuinely untenable, descope the leg with a written reason and removal condition under the repo's exact-finding exception discipline (never a blanket skip), recorded where the matrix is configured; verify with a PR-check run where the e2e matrix is green (or the descope recorded and the matrix honestly green on the remaining browsers)

## Workflow follow-up

- After all tasks complete: code review per project policy, then archive this change (`openspec archive`) and verify the archived state — via PR, since the code-scanning gate blocks direct pushes to `main`.
