# Proposal

## Why

The domain-driven review (`docs/domain-review.md`, finding CO-5) found
all ~26 taxonomy display strings living in two hand-synchronized homes:
as labels in the shared filter definitions (`UNIT_FILTERS`) and as
`taxonomy_*`/`detail_policy_*` keys in the web paraglide catalog, bridged
by `detail-values.ts`. Values match today purely by discipline — no test
cross-checks the sets, so a rewording on either side drifts silently.
This is the unguarded overlap of the settled schema-labels-vs-catalogs
split; the review also noted the split itself deserves a sentence in
`docs/shared-contracts.md` (localizing filter labels is by design a
contract change).

## What Changes

- Add a parity guard: either a test cross-checking contract labels
  against catalog values, or derive the detail panel's taxonomy labels
  from the served filter schema (decision made in planning)
- State the labels-vs-catalogs boundary in `docs/shared-contracts.md`
- Coordinate copy with `honest-unknown-labels` if both reword overlapping
  strings

## Capabilities

### New Capabilities

### Modified Capabilities

(Not expected to change spec-level behavior; test/doc work. Spawned with
`skip_specs` set — expected to stay, unlike the code-behavior proposals.)

## Impact

- **Code:** one parity test (or label derivation) in `apps/web`, the
  i18n audit if the boundary moves
- **Docs:** `docs/shared-contracts.md` (one paragraph)
- **Sequencing:** after `honest-unknown-labels` settles marker copy, to
  avoid double-touching the same strings
