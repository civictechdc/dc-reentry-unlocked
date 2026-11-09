# Proposal

## Why

One CI run of the repair branch (PR-check run 42535220837) had the e2e
card helper's direct `/units` fetch fail twice inside a ~6s window
("the units endpoint answers for the card helper" — both the initial
attempt and the retry), while the rest of the run's hundreds of API
round-trips were fine. The signature is consistent with the compose
API container restarting mid-run under matrix load (4 browser projects
in parallel; the API carries a 512m mem ceiling and serves the full
frozen dataset from memory).

The CI repair landed a bounded retry in the helper
(`threeDistinctPinCards`), which rides out such windows — but that
masks the root cause rather than fixing it. A restart landing inside
any other test's fetch window would still flake that leg, and an API
that restarts under load in CI is worth understanding before the
deployment pipeline work builds on the same image.

## What Changes

- Reproduce sustained matrix-like load against the compose API and
  confirm or rule out the restart hypothesis (compose logs/events,
  memory profile of the fastify dataset serving)
- Fix the root cause if confirmed (memory ceiling, GC churn under
  response bursts, healthcheck/restart policy) or document the true
  cause if different
- Add just enough observability that a future restart is visible in
  the CI log rather than inferable from test failures
- Revisit the helper retry once the cause is fixed: keep it only if
  restarts remain an accepted operating condition

## Capabilities

### New Capabilities

(none — CI-infra reliability; `skip_specs` until planned)

### Modified Capabilities

## Impact

- **Code:** `apps/api` (serving/memory posture), `compose.yaml`
  (limits/healthcheck), possibly the e2e helper — no API contract
  changes
- **Sequencing:** small investigation-first change; slots before or
  alongside `deployment-pipeline-planning`, which inherits whatever
  serving posture this settles
