# Proposal

## Why

The repo's first pull request (#1, 2026-11-08) was the first time the PR
checks workflow ever ran, and it exposed two gaps that have never been
green anywhere (`full.yml` has zero run history; pushes to `main` do not
run the PR-gate job):

1. **Typecheck without Paraglide codegen.** The generated
   `apps/web/src/lib/paraglide/` tree is self-gitignored, so a fresh
   checkout cannot typecheck: `svelte-check` fails on
   `#lib/paraglide/server.js` in `apps/web/src/hooks.server.ts`
   (PR-check run 42460002862, job 128667132719). Local runs pass only
   because dev machines carry the generated directory from previous
   compiles.
2. **Firefox e2e leg all-timeout.** Every `desktop-firefox` spec in the
   Compose e2e matrix times out waiting for `.unit-list article`
   (chromium and webkit green; run 42460002862, job 128667132599,
   including retries). No firefox leg has ever passed.

Until these are fixed, every PR shows red checks that have nothing to do
with the PR's content — which trains everyone to ignore CI, exactly the
failure mode a gate is supposed to prevent. The CodeQL merge gate that
just landed (ruleset `code-scanning-main-gate`) makes PR hygiene load-
bearing from here on.

## What Changes

- Add the Paraglide compile step before the web typecheck in `pr.yml`
  (and audit `full.yml` for the same gap), so a fresh checkout
  typechecks; verify via a PR-check run where the typecheck job is green
- Diagnose and repair the Firefox e2e leg (launch inside the Compose
  matrix, playwright firefox dependencies on ubuntu-24.04, or whatever
  the actual root cause turns out to be) — or, if Firefox-in-Compose is
  genuinely untenable, descope the leg with a written reason and removal
  condition under the repo's exact-finding exception discipline, never a
  blanket skip
- Both repairs land via PR (the code-scanning gate now blocks direct
  pushes to `main`)

## Capabilities

### New Capabilities

(none — CI workflow repair, spawned with `skip_specs`; no product
behavior changes)

### Modified Capabilities

## Impact

- **Code:** `.github/workflows/pr.yml` (codegen step; firefox e2e
  diagnosis/fix), possibly `full.yml` and the e2e configs — no product
  runtime code
- **Sequencing:** should land before heavy PR activity resumes
  (deployment-pipeline implementation) so the pipeline work starts from
  a green baseline; independent of the other in-flight changes
