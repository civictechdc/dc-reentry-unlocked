# Proposal

## Why

Live use of the prototype (user walkthrough of the exact-addresses-only app, 2026-11-03) showed the "0 bedrooms" presentation on zero-bedroom shared-room units reads as missing data rather than as an offer: the card's bedroom line says "0 bedrooms", the program-level housing type (e.g. "transitional housing") says nothing about the unit's room type, and the unit's own shared-room nature is not visible anywhere on the card. A returning citizen scanning the list cannot tell a dorm-style bed offer from a listing that forgot its bedroom count. The Studio change solved exactly this for 0BR efficiencies; shared-rooms need the same presentation-vocabulary treatment.

## What Changes

- Presentation-only: zero-bedroom **shared-room** units present their bedroom line as bed availability — "Bed available" — on the card's bedroom line and the detail's bedrooms row, instead of the numeric "0 bedrooms"
- Other bedroom counts and room types keep numeric presentation (private-room 1BR stays "1 bedroom(s)"; 0BR efficiency keeps "Studio")
- Bedrooms stay 0 in the data and contract (vocabulary change, same pattern and helper surface as the Studio mapping)
- The sr-only label semantics stay honest (the line is still the bedrooms dimension of the spec list)

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-search-ui`: MODIFIED requirement "Unit cards" — a zero-bedroom shared-room presents as bed availability rather than a numeric count

## Impact

- **Code:** `apps/web` only — `detail-values.ts` (the shared presentation-helper module; a sibling pair-mapping to the Studio one), `UnitCard.svelte` + `DetailSlideOver.svelte` call sites, paraglide `messages/en.json` (one new key), component tests, e2e steps only if any assert the shared-room numeric string
- **APIs / Dependencies:** none — contract and dataset untouched
- **Docs:** `docs/glossary.md` only if it later documents card vocabulary conventions (likely no touch)
- **Sequencing:** assumes the exact-addresses-only change is archived (its Studio requirement text is the base this delta modifies); independent of `card-map-focus` (map/camera work, no shared files beyond the card component itself, which card-map-focus does not edit)

## Non-goals

- No data-model, contract, or dataset change (bedrooms stay 0 for shared-rooms per the coherent pairs)
- No relabeling of nonzero bedroom counts or of private-room units
