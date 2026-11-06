# Proposal

## Why

The domain-driven review (`docs/domain-review.md`, finding CO-3) found
the synthetic-data provenance sentence — which the contract says is
carried "verbatim from the dataset" — maintained in four independent
copies: datagen (`SYNTHETIC_DISCLAIMER`), the API
(`SYNTHETIC_DISCLOSURE`, boot-checked against the file), the web message
catalog (`banner_body`), and the generated `data/units.json`. Only the
API-vs-file pair is guarded; the web copy is unguarded, and the web never
renders the served `disclosure` field at all (the client discards it).
The layer seam rules (correctly) forbid api↔datagen imports, so
`packages/shared` is the only home all copyists may import.

## What Changes

- Single-source the disclosure sentence in `packages/shared` (contract
  data), consumed by datagen, the API, and the web
- Decide and implement the consumer side honestly: either render the
  served `disclosure` in the web banner, or soften the contract's
  "carried verbatim" prose to match reality
- Keep the boot-time agreement check as the belt-and-braces guard

## Capabilities

### New Capabilities

### Modified Capabilities

- `housing-inventory-api` — disclosure envelope semantics (if rendering
  behavior changes)

(Spawned at proposal stage with `skip_specs` set; delta specs are
authored in this change's planning session, which unsets it.)

## Impact

- **Code:** `packages/shared`, `tools/datagen/src/generate.ts`,
  `apps/api/src/datasource.ts`, `apps/web` (banner source),
  `data/units.json` regeneration (sentence value unchanged →
  byte-identical expected)
- **Docs:** `docs/shared-contracts.md` if the prose changes
- **Sequencing:** independent; any time after the pre-push pair
