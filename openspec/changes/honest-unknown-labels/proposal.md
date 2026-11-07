# Proposal

## Why

The domain-driven review (`openspec/changes/archive/2026-11-06-domain-driven-review/domain-review.md`, finding CO-2, product
decision 2026-11-06) found two linked defects in how the unit card speaks
about program taxonomy:

1. **Dead resolution path.** `UnitCard.svelte` resolves the housing-type
   label through an optional `definition` prop that its only production
   caller never passes, so every card renders the unknown fallback
   regardless of data — a *known* taxonomy value ("transitional")
   presents as if the source never published it, the exact inversion of
   the unknown-honesty rule. The detail slide-over resolves the same
   value correctly through `detail-values.ts`; no test covers the card
   row.
2. **Marker wording.** The product owner judged the honest-unknown marker
   "Not publicly listed" itself misleading — it reads as real-estate
   language ("listed where?"). The wording must be reworded everywhere it
   appears.

## What Changes

- Resolve the card's housing-type (and any taxonomy) labels through the
  same mechanism the detail panel uses; delete the dead `definition` prop
- Add the missing card-row tests: known value → real label; unknown →
  the honest-unknown marker
- Reword the honest-unknown marker across spec scenarios, glossary,
  message catalog, and the generated data-model reference. Candidate
  copy ("Not stated by the source", "Not published", …) is decided here
  and should be vetted against the walkthrough audience

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-inventory` — spec scenarios pinning the current marker wording
- `housing-search-ui` — card rendering and marker copy

(Spawned at proposal stage with `skip_specs` set; delta specs are
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `apps/web/src/lib/components/UnitCard.svelte` (+ its caller,
  `apps/web/src/lib/components/detail-values.ts` if generalized),
  `apps/web/messages/en.json`
- **Docs:** `docs/glossary.md`, generated `docs/data-model.md`
- **Sequencing:** pre-push priority (product decision 2026-11-06); the
  marker-copy decision made here gates `taxonomy-label-parity`, which
  sequences itself after this change to avoid double-touching strings
