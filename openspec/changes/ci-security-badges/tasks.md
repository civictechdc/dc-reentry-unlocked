# Tasks

## 1. Security scanning in CI

- [x] 1.1 Research scanning gaps beyond the existing `pnpm audit`: SAST (CodeQL vs Semgrep for a TS/Node monorepo), secret scanning (gitleaks + GitHub-native push protection — what is free for this repo's visibility), container image scanning (Trivy — timed with the images the deployment pipeline will ship), and SBOM/dependency-review; verify cost and availability against current GitHub and scanner docs and cite them
- [x] 1.2 Add the user-chosen scanners to `pr.yml`/`full.yml` (the user picks the set first); accepted findings land on a documented ignore-list policy (same discipline as `pnpm audit`'s); verify a CI run is green with the scanners active (landed as a dedicated `.github/workflows/codeql.yml` instead — workflow-managed decision 2026-11-07)

## 2. Status badges

- [x] 2.1 Research badge options that reflect reality — CI status for the `pr.yml`/`full.yml` workflows, the `openspec validate` gate, tooling versions (Node/pnpm), license, anything else worth considering — verified against current GitHub Actions badge syntax and Shields.io docs; check the private-repo nuance (badges on private repos render only for collaborators with token access); the user picks the set
- [x] 2.2 Add the chosen badge row to `README.md`; verify every badge URL resolves and references real workflow file names on the default branch

## Workflow follow-up

- After all tasks complete: code review per project policy, then archive this change (`openspec archive`) and verify the archived state.
