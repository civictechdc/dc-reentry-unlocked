import { expect, test } from "vitest";

// One test per documented example in docs/shared-contracts.md, exercising
// the documented import 1:1. Same symbols, same subpaths — if a documented
// import stops compiling, `pnpm typecheck` and this file both fail.

import type { Program, Provider, Unit, UnitCard } from "@dc-reentry/shared";
import {
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  FilterDefinitionSchema,
  FilterSchemaResponseSchema,
  GENDERS,
  HOUSING_TYPES,
  LENGTHS_OF_STAY,
  POLICY_STATES,
  PolicyStateSchema,
  POPULATIONS,
  ProgramSchema,
  ProviderSchema,
  QUADRANTS,
  ROOM_TYPES,
  UNIT_FILTERS,
  UnitsResponseSchema,
  UnitCardSchema,
  UnitSchema,
  Value,
} from "@dc-reentry/shared";
import { aProvider, aProgram, aUnit } from "@dc-reentry/shared/testing";

const sampleCard: UnitCard = aUnit().build();

const aUnitEntity = (
  overrides?: Partial<{
    availabilityState: Unit["availabilityState"];
    availabilityConfirmed: boolean;
  }>,
): Unit => ({
  id: sampleCard.id,
  programId: sampleCard.programId,
  address: sampleCard.address,
  ward: sampleCard.ward,
  quadrant: sampleCard.quadrant,
  coordinates: sampleCard.coordinates,
  bedrooms: sampleCard.bedrooms,
  size: sampleCard.size,
  cost: sampleCard.cost,
  availabilityState: overrides?.availabilityState ?? "available",
  availabilityConfirmed: overrides?.availabilityConfirmed ?? true,
});

// docs/shared-contracts.md — Example 1: entity schemas
test("example 1 compiles: entity schemas validate real providers, programs, units", () => {
  const someProvider = aProvider().build();
  const someProgram = aProgram().build();
  const unitForTheInventory = aUnitEntity({
    availabilityState: "unverified-availability",
    availabilityConfirmed: false,
  });

  expect(Value.Check(ProviderSchema, someProvider)).toBe(true);
  expect(Value.Check(ProgramSchema, someProgram)).toBe(true);
  expect(Value.Check(UnitSchema, unitForTheInventory)).toBe(true);
});

// Example 2: the flattened unit card
test("example 2 compiles: the unit card validates a fluent-built unit card", () => {
  const validCard: UnitCard = aUnit().inWard(5).build();

  expect(validCard.coordinates).toEqual({ latitude: 38.913, longitude: -77.032 });
  expect(Value.Check(UnitCardSchema, validCard)).toBe(true);
});

// Example 3: derived TS types
test("example 3 compiles: derived TS types annotate real shapes", () => {
  const provider: Provider = aProvider().build();
  const program: Program = aProgram().build();
  const unit: Unit = aUnitEntity();

  expect(provider.organization.length).toBeGreaterThan(0);
  expect(program.id.length).toBeGreaterThan(0);
  expect(unit.ward).toBe(1);
});

// Example 4: unknown semantics
test("example 4 compiles: PolicyState accepts honest unknown and rejects invented answers", () => {
  expect(Value.Check(PolicyStateSchema, "unknown")).toBe(true);
  expect(Value.Check(PolicyStateSchema, "yes")).toBe(true);
  expect(Value.Check(PolicyStateSchema, "perhaps")).toBe(false);
});

// Example 5: taxonomies
test("example 5 compiles: taxonomy constants are exported data", () => {
  expect(HOUSING_TYPES.length).toBe(5);
  expect(LENGTHS_OF_STAY.length).toBe(4);
  expect(POPULATIONS.length).toBe(3);
  expect(GENDERS.length).toBe(3);
  expect(QUADRANTS.length).toBe(4);
  expect(ROOM_TYPES.length).toBe(4);
  expect(POLICY_STATES.length).toBe(3);
});

// Example 6: filter schema contract
test("example 6 compiles: filter definitions validate as data", () => {
  expect(UNIT_FILTERS.length).toBe(11);
  expect(Value.Check(FilterDefinitionSchema, UNIT_FILTERS[0]!)).toBe(true);
});

// Example 7: API envelopes
test("example 7 compiles: envelopes validate real payloads", () => {
  const payloadFromApi = {
    schemaVersion: "0.2",
    synthetic: true as const,
    disclosure: "Synthetic prototype data — fictional providers. Never contact.",
    units: [aUnit().build()],
  };
  const schemaPayloadFromApi = { schemaVersion: "0.2", filters: UNIT_FILTERS };
  const errorFromApi = {
    schemaVersion: "0.2",
    code: "not-found",
    message: "Unit not found.",
  };

  expect(Value.Check(UnitsResponseSchema, payloadFromApi)).toBe(true);
  expect(Value.Check(FilterSchemaResponseSchema, schemaPayloadFromApi)).toBe(true);
  expect(Value.Check(ErrorEnvelopeSchema, errorFromApi)).toBe(true);
  expect(Value.Check(ErrorCodeSchema, errorFromApi.code)).toBe(true);
});

// Example 8: test-only domain builders
test("example 8 compiles: test-only builders arrange from the testing subpath", () => {
  const unit = aUnit().inWard(5).withUnknownSobrietyPolicy().build();

  expect(unit.program.sobrietyRequired).toBe("unknown");
});
