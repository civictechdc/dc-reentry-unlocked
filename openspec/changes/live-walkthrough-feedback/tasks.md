# Tasks

## 1. Walkthrough harness and first session

- [ ] 1.1 Build the walkthrough capture harness: a headed Playwright session script (outside both CI configs' test patterns) that boots the stack, presents the app to the user, and emits a timestamped structured event log (interactions with best-effort labels, filter applications + result counts, zero-result encounters, console errors/warnings, failed requests, slow interactions); verify a dry-run session against the dev stack produces a well-formed log with real events and that no CI suite picks the script up
- [ ] 1.2 Run the first synchronous walkthrough WITH the user (after `exact-addresses-only` and `card-map-focus` have landed): user directs the session and reacts; capture their attributed conversational feedback time-correlated with the event log; synthesize both streams into `docs/feedback/<date>-walkthrough.md` (timeline, friction points, positive observations, quotes, candidate follow-up items phrased for citation); verify the user reviews and signs off the record before it is committed, and the harness ships no instrumentation in the production build

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
- The walkthrough record's candidate follow-up items are inputs for future change proposals, not tasks of this change.
