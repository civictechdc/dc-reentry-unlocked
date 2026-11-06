# Proposal

## Why

Two domain-driven review findings (`docs/domain-review.md`: DM-8, CO-9)
concern the shared test builders in `packages/shared/src/testing`:

- **DM-8:** `aUnit()` returns a `UnitCardBuilder` — the fixture name says
  Unit (the hierarchy leaf per the glossary) but builds the joined card
  read model; its defaults combine one bedroom with an efficiency, which
  the inventory spec's own domain rule forbids (efficiencies have zero
  bedrooms); and the missing entity builders force local `aUnitEntity`
  factories in `entities.test.ts` and `shared-contracts.test.ts`,
  contrary to the centralized-builder doctrine.
- **CO-9:** every program policy field costs four hand-written methods
  (a `withX`/`withUnknownX` pair on `ProgramBuilder` plus the mirrored
  delegation pair on `UnitCardBuilder`); forgetting a pair fails
  silently — the fluent form is just unavailable.

## What Changes

- Name fixtures honestly: `aUnitCard()` for the card builder, a real
  `aUnit()`/entity builders for hierarchy entities; retire the local
  factories
- Fix the default fixture to a domain-valid combination (or make the
  invalid combination explicit at the call sites that want it)
- Contain delegation growth: data-driven delegation over the policy-key
  map, or a `withProgram(partial)` escape hatch (decision in planning)

## Capabilities

### New Capabilities

### Modified Capabilities

(Test-only; no spec-level behavior change. Spawned with `skip_specs` set
— expected to stay.)

## Impact

- **Code:** `packages/shared/src/testing/index.ts`, call sites across
  workspaces' tests
- **Docs:** none expected
- **Sequencing:** independent; a good rider-quality change but scoped
  here on its own merits per the review
