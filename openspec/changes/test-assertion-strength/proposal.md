# Proposal

## Why

Two domain-driven review findings (`openspec/changes/archive/2026-11-06-domain-driven-review/domain-review.md`: DM-10,
DM-11) found acceptance and unit tests whose names claim more than their
assertions prove:

- **DM-10:** the dynamic-filtering acceptance scenario requires "the
  same result set" / "exactly the matching units" across API, cards, and
  map pins — the step driver compares *counts* plus one ward label.
  Equal-sized but different unit sets would pass.
- **DM-11:** the housing store's concurrency tests claim rapid selection
  changes "do not interleave stale responses," but the replacement
  transport returns empty arrays immediately and assertions inspect
  request count/path only; the property variant accepts any historical
  path without awaiting the outstanding refresh cycle. Final observable
  state is never checked against controlled delayed payloads.

## What Changes

- E2e filter steps compare unit *identities* across the API response,
  card list, and map pins (counts stay as supporting checks)
- Store concurrency tests use controlled delayed promises and assert the
  final rendered result, distinguishing interim loading state from
  final-state correctness

## Capabilities

### New Capabilities

### Modified Capabilities

(Test-only; no spec-level behavior change. Spawned with `skip_specs` set
— expected to stay.)

## Impact

- **Code:** `apps/web/e2e/steps/filter.steps.ts`,
  `apps/web/src/lib/state/housing-store.test.ts` +
  `housing-store.prop.test.ts`
- **Docs:** none expected
- **Sequencing:** independent
