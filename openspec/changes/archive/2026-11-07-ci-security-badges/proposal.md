# Proposal

## Why

CI's security coverage stops at dependency CVEs: `pnpm audit --prod`
runs on every PR and the full-graph audit on the manual suite
(`pr.yml`, `full.yml`, with the documented ignore policy) — no SAST, no
secret scanning, no container image scanning, no SBOM. And the repo's
front door (`README.md`) carries no status badges, so workflow health is
invisible without opening GitHub Actions. Both are CI/repo-surface
hygiene rather than deployment planning, and both underpin the upcoming
deployment work — scanners for the images and lanes it will ship,
badges for the pipeline health it will produce. They belong in their own
change, landing before the deployment-pipeline planning starts.

## What Changes

- Research security scanning beyond `pnpm audit` — SAST (CodeQL vs
  Semgrep for a TS/Node monorepo), secret scanning (gitleaks plus
  GitHub-native push protection, checked against the repo's visibility
  and cost), container image scanning (Trivy, timed with the images the
  deployment pipeline will ship), and SBOM/dependency-review — verified
  against current GitHub and scanner docs, not training memory
- The user picks the scanner set; the chosen scanners land in
  `pr.yml`/`full.yml`, accepted findings documented on an ignore-list
  policy (same discipline as `pnpm audit`'s), and a CI run verified green
- Research status badges that reflect reality (CI status for
  `pr.yml`/`full.yml`, the `openspec validate` gate, tooling versions,
  license — syntax verified against current GitHub Actions badge and
  Shields.io docs; private-repo rendering nuance checked); the user picks
  the set and the badge row lands in `README.md`, every URL verified
  against real workflow file names on the default branch

## Capabilities

### New Capabilities

(possibly a `security-scanning` capability — spawned at proposal stage
with `skip_specs`; delta specs are authored in this change's planning
session, which unsets it)

### Modified Capabilities

## Impact

- **Code:** `.github/workflows/pr.yml`, `.github/workflows/full.yml`
  (scanner additions only)
- **Docs:** `README.md` (badge row)
- **Sequencing:** lands before `deployment-pipeline-planning` starts;
  independent of the in-flight product changes (no app code touched)
