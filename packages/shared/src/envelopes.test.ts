import { expect, test } from "vitest";
import { Value } from "typebox/value";
import {
  ERROR_CODES,
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  FilterSchemaResponseSchema,
  SCHEMA_VERSION,
  SYNTHETIC_DISCLOSURE,
  UnitsResponseIntakeSchema,
  UnitsResponseSchema,
  UNIT_FILTERS,
  type UnitCard,
} from "./index";
import { aUnitCard } from "./testing";

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

const validUnitsEnvelope = () => ({
  schemaVersion: SCHEMA_VERSION,
  synthetic: true as const,
  disclosure: SYNTHETIC_DISCLOSURE,
  units: [aUnitCard().inWard(5).build()],
});

test("an available-units listing is a valid envelope and survives a round-trip", () => {
  const response = validUnitsEnvelope();

  expect(Value.Check(UnitsResponseSchema, response)).toBe(true);
  expect(response.units.length).toBe(1);
  expect(response.synthetic).toBe(true);
  expect(Value.Check(UnitsResponseSchema, roundTrip(response))).toBe(true);
});

test("an unmarked payload is not a valid units envelope — synthetic provenance is required", () => {
  const unmarked = {
    schemaVersion: SCHEMA_VERSION,
    units: [aUnitCard().inWard(5).build()],
  };

  expect(Value.Check(UnitsResponseSchema, unmarked)).toBe(false);
});

test("the synthetic marker is a literal true, never a false claim", () => {
  const falseClaim = {
    schemaVersion: SCHEMA_VERSION,
    synthetic: false,
    disclosure: SYNTHETIC_DISCLOSURE,
    units: [aUnitCard().build()],
  };

  expect(Value.Check(UnitsResponseSchema, falseClaim)).toBe(false);
});

test("an envelope without the disclosure sentence fails validation", () => {
  const withoutDisclosure = {
    schemaVersion: SCHEMA_VERSION,
    synthetic: true as const,
    units: [aUnitCard().build()],
  };

  expect(Value.Check(UnitsResponseSchema, withoutDisclosure)).toBe(false);
});

test("a filter-schema response is a valid envelope carrying all 11 definitions", () => {
  const response = { schemaVersion: SCHEMA_VERSION, filters: UNIT_FILTERS };

  expect(Value.Check(FilterSchemaResponseSchema, response)).toBe(true);
  expect(response.filters.length).toBe(11);
  expect(Value.Check(FilterSchemaResponseSchema, roundTrip(response))).toBe(true);
});

test("the error envelope carries a stable machine code, message, and correlation id", () => {
  const degraded = {
    schemaVersion: SCHEMA_VERSION,
    code: "service-unavailable",
    message: "Housing data is temporarily unavailable.",
    correlationId: "req-test-1",
  };

  expect(Value.Check(ErrorEnvelopeSchema, degraded)).toBe(true);
  expect(Value.Check(ErrorEnvelopeSchema, roundTrip(degraded))).toBe(true);
});

test("an error envelope without a correlation id is still valid", () => {
  const minimal = {
    schemaVersion: SCHEMA_VERSION,
    code: "not-found",
    message: "Unit not found.",
  };

  expect(Value.Check(ErrorEnvelopeSchema, minimal)).toBe(true);
});

test("only the pinned machine codes are envelope-valid", () => {
  expect(ERROR_CODES).toEqual([
    "not-found",
    "service-unavailable",
    "invalid-filter",
    "invalid-request",
    "internal-error",
    "rate-limited",
  ]);

  expect(Value.Check(ErrorCodeSchema, "not-found")).toBe(true);
  expect(Value.Check(ErrorCodeSchema, "oops")).toBe(false);
});

test("an envelope without a machine code fails validation", () => {
  const broken = {
    schemaVersion: SCHEMA_VERSION,
    message: "no code attached",
  };

  expect(Value.Check(ErrorEnvelopeSchema, broken)).toBe(false);
});

test("envelope consumers tolerate future fields", () => {
  const evolved = { futureField: { note: "a contract revision added this" } };

  expect(Value.Check(UnitsResponseSchema, { ...validUnitsEnvelope(), units: [], ...evolved })).toBe(
    true,
  );
  expect(
    Value.Check(FilterSchemaResponseSchema, {
      schemaVersion: SCHEMA_VERSION,
      filters: [],
      ...evolved,
    }),
  ).toBe(true);
  expect(
    Value.Check(ErrorEnvelopeSchema, {
      schemaVersion: SCHEMA_VERSION,
      code: "internal-error",
      message: "scratch",
      ...evolved,
    }),
  ).toBe(true);
});

const intakeEnvelopeWith = (card: UnitCard) => ({
  schemaVersion: SCHEMA_VERSION,
  synthetic: true as const,
  disclosure: SYNTHETIC_DISCLOSURE,
  units: [card],
});

test("a taxonomy value newer than the vocabulary passes the tolerant intake envelope and fails the strict contract", () => {
  // the producer has evolved a housing type this consumer never compiled
  // (test-local widening: the future value has no type in this build)
  const futureCard = aUnitCard()
    .withProgram({ housingType: "rapid-rehousing" } as never)
    .build();

  expect(Value.Check(UnitsResponseIntakeSchema, intakeEnvelopeWith(futureCard))).toBe(true);
  expect(Value.Check(UnitsResponseSchema, intakeEnvelopeWith(futureCard))).toBe(false);
});

test("a known taxonomy value passes both the strict contract and the tolerant intake envelope", () => {
  const knownCard = aUnitCard().withHousingType("transitional").build();

  expect(Value.Check(UnitsResponseIntakeSchema, intakeEnvelopeWith(knownCard))).toBe(true);
  expect(Value.Check(UnitsResponseSchema, intakeEnvelopeWith(knownCard))).toBe(true);
});

test("an empty taxonomy value still fails the tolerant intake envelope", () => {
  // tolerance widens the vocabulary, it does not accept a degenerate blank
  const blankCard = aUnitCard()
    .withProgram({ housingType: "" } as never)
    .build();

  expect(Value.Check(UnitsResponseIntakeSchema, intakeEnvelopeWith(blankCard))).toBe(false);
});

test("the tolerant intake envelope still rejects an unmarked payload and a false synthetic marker", () => {
  const futureCard = aUnitCard()
    .withProgram({ housingType: "rapid-rehousing" } as never)
    .build();
  const unmarked = {
    schemaVersion: SCHEMA_VERSION,
    units: [futureCard],
  };
  const falseClaim = { ...intakeEnvelopeWith(futureCard), synthetic: false };

  expect(Value.Check(UnitsResponseIntakeSchema, unmarked)).toBe(false);
  expect(Value.Check(UnitsResponseIntakeSchema, falseClaim)).toBe(false);
});
