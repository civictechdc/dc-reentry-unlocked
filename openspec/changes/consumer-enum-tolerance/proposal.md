# Proposal

## Why

The domain-driven review (`docs/domain-review.md`, finding DM-2, product
decision 2026-11-06) found the inventory capability's consumer-tolerance
promise — "consumers built against the previous revision continue to
function … new fields/enum values are ignorable" — only half-true in the
built system. Extra fields pass intake; new enum values do not: every
eligibility field is a closed union (`current taxonomy | "unknown"`), and
the web client validates the whole `/units` envelope against it and
throws. A newly added taxonomy value would fail every older frontend at
intake — worse, its only fallback vocabulary is the honest-unknown
marker, conflating *newer-than-your-vocabulary* with *not published*.
The product owner decided the promise binds: tolerant intake is real
work.

## What Changes

- Design tolerant consumer intake: new enum values pass validation and
  render with a presentation distinct from the honest-unknown marker —
  two different unknowns that must never conflate (binding constraint,
  product decision 2026-11-06)
- Producer-side validation stays strict; tolerance is a consumer-intake
  concern
- Extend the evolution tests from extra fields to future enum values

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-inventory` — the model-revision-consumed-gracefully scenario
- `housing-inventory-api` — the served-contract guarantee
- `housing-search-ui` — client intake and rendering of future values

(Spawned at proposal stage with `skip_specs` set; delta specs are
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `packages/shared` (intake-validation posture),
  `apps/web/src/lib/api/client.ts`, tests in both
- **Docs:** `docs/shared-contracts.md`
- **Sequencing:** coordinate with `consumer-enum`-adjacent work in
  `filter-target-semantics`; independent of the pre-push pair
