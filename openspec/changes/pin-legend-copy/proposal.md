# Proposal

## Why

User walkthrough feedback (2026-11-03): the map pin legend reads "Exact address" — vocabulary from the era when pins could be approximate (ward-anchor) or exact. In the exact-addresses-only world every pin is exact, so the legend's copy describes a distinction that no longer exists and says nothing useful to a returning citizen scanning the map. What a pin actually represents now: an available unit. The legend should say so.

## What Changes

- Legend copy: `map_legend_exact` ("Exact address") becomes "Available unit" (key renamed to match, e.g. `map_legend_unit`, so the identifier is not a lie)
- Legend title ("What the pins mean") and structure unchanged; one entry, as pinned by the existing component test
- Component test names/assertions updated to the new vocabulary

## Capabilities

### New Capabilities

### Modified Capabilities

(No spec delta: no spec text pins legend copy — `skip_specs` per the repo's established pattern for non-behavioral copy changes.)

## Impact

- **Code:** `apps/web` only — `messages/en.json` (key + value), `MapView.svelte` (key reference), `MapView.test.ts` (vocabulary pins)
- **APIs / Dependencies / Docs:** none
- **Sequencing:** independent; trivially mergeable alongside any other planned change

## Non-goals

- No legend restructuring, no new entries, no map changes
