# Proposal

## Why

The product works with exact addresses for now (user decision 2026-10-31): ward-only (approximate-location) units were modeling a real-data phenomenon — providers that publish only a ward — but that behavior is not wanted in this prototype, and the ward-anchor pins read as confusing rather than honest. Removing the concept simplifies the data model, the map, and the detail view. The removal is deliberate and reversible: if the future real-data ingestion receives ward-only units, a follow-up change reintroduces precision as an additive contract extension.

## What Changes

- **BREAKING** (contract): `locationPrecision` is removed from the Unit and UnitCard schemas; `coordinates` becomes required (non-null) on both; `SCHEMA_VERSION` bumps 1.0 → 2.0 per the stable-contract rule (breaking changes are versioned)
- **BREAKING** (dataset): the frozen dataset regenerates as `data/units.v2.json` — 100% exact-address units on real DC street geometry, fixed seed, byte-identical regeneration re-proven; the v1 file is deleted
- Datagen drops the approximate distribution entirely; every unit derives from a real street piece with real coordinates
- The web map loses the approximate machinery: ward-anchor placement, dashed pin style, approximate legend entry, and the detail view's approximate-location qualifier
- Ward and quadrant fields remain (they describe exact units); the ward filter is unaffected
- Bedrooms and room type become coherent (user decision 2026-10-31): the generator correlates bedrooms with room type — apartment is never 0-bedroom, efficiency is always 0, private-room 1, shared-room 0 — killing the 94 incoherent 0BR "apartments"; zero-bedroom efficiencies remain in the data (they are the studio/SRO inventory)
- The UI presents zero-bedroom efficiencies as "Studio" (a message-key relabel on card and detail — how real listings present 0BR) instead of "0 bedrooms"
- Spec deltas remove the "Location precision as first-class" requirement (housing-inventory) and drop location precision from the served card field list (housing-inventory-api); the search-ui spec never referenced precision — its approximate rendering was implementation honesty that goes away with the concept
- The `card-map-focus` change (planned, unimplemented) is amended to assume exact-only units — its ward-anchor focus case disappears

## Capabilities

### New Capabilities

### Modified Capabilities
- `housing-inventory`: REMOVED requirement "Location precision as first-class" (approximate locations are no longer representable — coordinates are required)
- `housing-inventory-api`: MODIFIED requirement "Available units listing" — the unit card field list drops location precision; coordinates are always present
- `housing-search-ui`: MODIFIED requirement "Unit cards" — zero-bedroom efficiencies present as "Studio" (bedrooms stay 0 in the data; the presentation vocabulary changes)

## Impact

- **Code:** `packages/shared` (LocationPrecision removal, coordinates required, SCHEMA_VERSION 2.0, builders), `tools/datagen` (exact-only generation, v2 dataset, determinism + geography properties re-proven), `apps/api` (loader: v2 file + version assert; served cards), `apps/web` (ward-anchors.ts deleted, map styles/legend/feature-collection simplified, detail qualifier + message keys removed, i18n audit stays green)
- **APIs:** breaking contract change — schemaVersion 2.0; no external consumers exist today (prototype), so the bump is prophylactic compliance with the versioning rule
- **Dependencies:** none
- **Docs:** glossary (location-precision term removed), data-synthetic (approximate share + provenance wording), shared-contracts (field list + examples), the data-model skill's contract description, AGENTS.md unknown-honesty section (location-precision mention), perf-notes (approximate share references)
- **Sequencing:** implement before `card-map-focus` (which is amended to assume this change's world)
