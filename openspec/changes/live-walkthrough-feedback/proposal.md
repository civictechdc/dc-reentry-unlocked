# Proposal

## Why

The prototype has never been used by its intended audience in a guided session. Before pushing and seeking broader feedback, a synchronous walkthrough with the user — the agent driving or observing a live session while the user directs and reacts — should capture both what the user SAYS (conversational feedback) and what the session SURFACES (usage signals: interactions, zero-result encounters, console errors, failed or slow requests), synthesized into a structured record future changes can cite.

## What Changes

- A walkthrough harness: a browser session mechanism (agent-driven, Playwright-based — the repo's e2e tooling reused) that records structured usage events during a live session against the running stack
- A synchronous walkthrough run WITH the user: the user directs the session and comments; their conversational feedback is captured verbatim-attributed alongside the session's usage signals
- A structured feedback document per session (`docs/feedback/<date>-walkthrough.md`): both streams synthesized — observations, friction points, quoted feedback, and candidate follow-up items — committed to the repo as product learnings
- Walkthrough-scoped only: the harness is dev tooling, never shipped; the no-analytics non-goal of the product stands untouched

## Capabilities

### New Capabilities
- `walkthrough-feedback`: the guided live-session feedback workflow — running a synchronous walkthrough of the running web app with the user, capturing conversational and browser-session feedback, and producing the structured feedback record

### Modified Capabilities

## Impact

- **Code:** a dev-tool script under `apps/web/e2e/` (or `scripts/`) reusing Playwright to run/attach a session and emit a structured event log; no product-code changes (no app instrumentation, no analytics)
- **APIs / Dependencies:** none (Playwright already a dev dependency)
- **Docs:** `docs/feedback/` (new directory, one committed record per session)
- **Sequencing:** preconditions met — `exact-addresses-only` and
  `card-map-focus` both landed (archived 2026-11-03/2026-11-04), and the
  capture harness (task 1.1) is built, reviewed, and committed
  (2026-11-07). The synchronous walkthrough session (task 1.2) is the
  next active step in the queue: `ci-security-badges` code tasks landed
  2026-11-07, and `deployment-pipeline-planning` waits on this session.
