# Proposal

## Why

The first live walkthrough session (2026-11-07, recorded in
`docs/feedback/2026-11-07-walkthrough.md`) produced a stream of candidate
UI features (map zoom buttons, recenter-to-locale control, pin-label
changes, and more to come). Trying such candidates against the running
app currently means either shipping them unconditionally or maintaining
throwaway branches. A feature-flag mechanism lets the user trial
candidate behavior in dev sessions and strip it from every non-dev
build, so experimentation never leaks into production, pre-prod, or
beta artifacts.

## What Changes

- A feature-flag mechanism for the web app with two toggle surfaces:
  - **Command time** — flags set when launching the dev server (CLI
    args/env), applying to the whole session
  - **Run time (dev builds only, potentially)** — toggling during a dev
    session without a restart; explicitly NOT available in non-dev
    builds
- Build-time elimination: code guarded by a flag is dead-code-eliminated
  from production, pre-prod, and beta builds — flagged features are kept
  only in dev builds; no flag machinery ships as a runtime toggle in
  non-dev artifacts
- (Mechanism — compile-time defines vs. dev-only runtime registry — is a
  planning-session decision, not fixed here)

## Capabilities

### New Capabilities

- `feature-flags`: guarding candidate/in-development features behind
  dev-only toggles with guaranteed stripping from non-dev builds

### Modified Capabilities

## Impact

- **Code:** `apps/web` build configuration and a small dev-only flag
  surface; first consumers are upcoming walkthrough-candidate features
- **Docs:** dev-runbook note on toggling flags when the mechanism lands
- **Sequencing:** independent; spawned from the 2026-11-07 walkthrough
  session. Planning authors specs/design/tasks (and unsets
  `skip_specs`). **Next up** (user decision 2026-11-07): planned and
  built in the next session(s); the walkthrough quick-wins change rides
  behind its flags as its first consumer.

(Spawned at proposal stage with `skip_specs` set.)
