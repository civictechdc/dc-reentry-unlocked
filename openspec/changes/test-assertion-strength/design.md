# Design

## Context

Two domain-driven review findings (DM-10, DM-11 in
`openspec/changes/archive/2026-11-06-domain-driven-review/domain-review.md`;
motivation in `proposal.md`) name acceptance and unit tests whose claims
outrun their assertions:

- **DM-10:** the dynamic-filtering golden-path step
  (`apps/web/e2e/steps/filter.steps.ts`, "map pins and card list both
  reflect exactly the matching units") compares the API response, the
  card list, and the map pins by **count** plus one ward-text filter.
  The spec requires "the same result set" / "exactly the matching
  units" — equal-sized but different unit sets would pass today.
- **DM-11:** `apps/web/src/lib/state/housing-store.test.ts` ("rapid
  selection changes do not interleave stale responses") mocks the
  transport with immediate empty arrays and asserts request count and
  final path only; the fast-check sibling
  (`housing-store.prop.test.ts`) accepts any historical path after the
  generated sequence without awaiting the outstanding refresh cycle.
  Neither observes rendered results under controlled delayed payloads.

Surfaces involved: the e2e step driver (identity sources — API
`units[].id`, pin-list buttons already carry `data-unit-id` at
`MapView.svelte:444`, cards carry only `aria-labelledby="card-title-{id}"`);
the store's dispatch gate (`housing-store.svelte.ts` — `refresh()`
returns the in-flight `#refreshCycle`, and `#drainRequests()` re-runs
while `#refetchRequestedWhileInFlight`, so awaiting `refresh()` always
drains to the latest selection).

Constraints: test-only in spirit (`skip_specs` stays); the store's
coalescing gate is correct — the tests must prove it, not change it;
e2e verification must use the self-booted dev-server BDD suite.

## Goals / Non-Goals

**Goals:**

- The golden-path step proves unit **identity** equality three ways:
  API response ids == rendered card ids == rendered pin ids, with
  counts and the ward-text check kept as supporting assertions.
- The concurrency unit test drives the gate with **controlled delayed
  promises** (stale-first resolution ordering forced), distinguishes
  the interim loading state from the final state, and asserts the
  final rendered units are exactly the latest selection's payload.
- The property test upgrades from "final path is any historical path"
  to **exact final path + exact final rendered state**, awaited past
  the outstanding refresh cycle.

**Non-Goals:**

- No store/production behavior changes beyond one observability
  attribute (`data-unit-id` on the card article — Decision 1).
- No new e2e scenarios; the existing scenario's assertion step
  strengthens in place.
- No fake timers (the gate is await-based, not timer-based; manual
  deferreds are deterministic without timer control).
- No spec deltas.

## Decisions

### Decision 1 — cards expose `data-unit-id` (user call, 2026-11-14)

The UnitCard `<article>` gains `data-unit-id={card.id}`, mirroring the
pin-list buttons (`MapView.svelte:444`) and following the
`webkit-ci-fidelity` observability-hook precedent (attributes whose
single consumer is test observability). Rejected: scraping
`aria-labelledby="card-title-{id}"` prefixes — works (the a11y name is
a stable contract) but puts string parsing in the step driver; visible
text keys — addresses are not guaranteed unique across the corpus.

### Decision 2 — DM-10: three-way sorted-id-set equality

The step fetches the oracle response, sorts `units[].id`, sorts the
rendered card `data-unit-id` values, sorts the rendered pin-list
`data-unit-id` values, and asserts all three sets equal (Playwright
`evaluateAll`). The `.result-count` gate (already present) stays as
the synchronization wait; counts stay as supporting checks; the
ward-text filter check stays. Identity equality makes equal-sized
different sets fail loudly, which is the finding's exact gap.

### Decision 3 — DM-11 unit test: deferred transport, stale-first ordering

Replace the immediate-empty mock with a transport whose `units(path)`
returns caller-held deferred promises. Sequence: select ward 1 (request
A, deferred A holding ward-1 cards) → select ward 2 while A is in
flight (coalesced) → resolve A → the drain loop issues request B
(deferred B holding ward-2 cards) → resolve B. Assert: `phase` is
`"loading"` while A pends; after `await refresh()` resolves, `units`
deep-equals the ward-2 cards (the LATEST selection's payload — a
broken gate would commit ward-1's stale payload last and fail), and
`phase` is `"ready"`. Interim commit of A's cards may be asserted
between resolutions (the drain's intermediate write is correct, not
stale). No fake timers.

### Decision 4 — DM-11 property test: deterministic per-path payloads + final await

The recording transport maps path → deterministic payload (a card
whose id encodes the path). `fc.modelRun` stays synchronous (fast-check
commands must be sync); after the run, `await store.refresh()` joins
the in-flight cycle or flushes one final no-op request (selection
unchanged ⇒ same path), then the test asserts `lastPath` equals the
model's final `expectedPath` exactly and `store.units` deep-equals the
payload for that path. History-membership checks remain as interim
invariants inside `verify` only.

## Risks / Trade-offs

- [Card identity step depends on `data-unit-id` staying rendered] →
  removal fails the golden path loudly at the identity read — the
  attribute is the contract, like the pin-list's.
- [Deferred-promise test encodes drain-loop ordering] → intentional:
  the ordering IS the specified coalescing contract; if `refresh()`
  internals change shape, the test follows the contract, not the
  implementation detail.
- [Post-`modelRun` refresh may issue one extra request] → selection is
  unchanged, so the request path repeats and the payload mapping is a
  pure function of path — final assertions unaffected; the extra cycle
  is what awaiting quiescence means for this store.
- [BDD suite runtime] → unchanged scenarios; only the assertion step's
  work grows by three DOM reads.

## Migration Plan

Single change, no deploy implications. Every step stays green:

1. Add `data-unit-id` to the UnitCard article; strengthen the
   golden-path step to three-way identity equality; run the BDD suite
   against self-booted dev servers.
2. Rebuild the concurrency unit test on the deferred transport with
   final-state assertions.
3. Upgrade the property test's transport and final-state assertions.
4. Full gates from the worktree root; conventional commits.

Rollback: single `git revert`; no runtime surface touched beyond one
attribute.
