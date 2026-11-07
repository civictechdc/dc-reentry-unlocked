# Proposal

## Why

The 2026-11-07 walkthrough session (recorded in
`docs/feedback/2026-11-07-walkthrough.md`) showed the app holding up under
directed use but left random-input robustness untested. Monkey testing —
random clicks, inputs, and gestures looking for crashes, stuck states, and
console errors — is a cheap complement to the repo's deterministic e2e
suites for a UI this interactive (map, filters, detail cards). Before
adopting anything, feasibility needs research: what monkey testing covers
well, what tooling fits a SvelteKit SPA with an existing Playwright
setup, and whether the payoff justifies the noise.

The user supplied three starting guides for the research:

- https://www.testmuai.com/learning-hub/monkey-testing/
- https://www.qasource.com/blog/a-complete-guide-to-monkey-testing
- https://blog.testunity.com/a-complete-guide-to-monkey-testing/

## What Changes

- A research task: evaluate monkey-testing feasibility for this app —
  technique variants (dumb vs smart monkeys, gorilla testing), tool
  options that integrate with or complement the existing Playwright e2e
  tooling, scope (which surfaces: filter bar, map, detail card, mobile
  profiles), signal handling (console errors, page errors, request
  failures as failure oracles), and expected noise/triage cost
- Output: a recommendation with sources — adopt / adapt / reject, and if
  adopt, a sketch of what the harness change would look like (dev
  tooling, like the walkthrough capture harness; nothing shipped)

## Capabilities

### New Capabilities

### Modified Capabilities

(Research-only at proposal stage; no spec-level behavior change. Spawned
with `skip_specs` set.)

## Impact

- **Code:** none at proposal stage; a follow-up change would add dev-only
  tooling if the recommendation is adopt
- **Docs:** the research record itself (with sources)
- **Sequencing:** independent; spawned from the 2026-11-07 walkthrough
  session

(Spawned at proposal stage with `skip_specs` set.)
