import { expect, test } from "vitest";
import { Value } from "typebox/value";
import type { Program, Unit } from "./index";
import {
  AvailabilityStateSchema,
  ProgramSchema,
  ProviderSchema,
  RoomTypeSchema,
  UnitSizeSchema,
  UnitSchema,
  WardSchema,
} from "./index";
import { aProvider, aProgram, aUnit } from "./testing";

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

test("every tri-state availability state survives a JSON round-trip", () => {
  const states = ["available", "not-available", "unverified-availability"] as const;
  const unitsByAvailability: Record<(typeof states)[number], Unit> = {
    available: aUnit().available().build(),
    "not-available": aUnit().unavailable().build(),
    "unverified-availability": aUnit().withUnverifiedAvailability().build(),
  };

  for (const availabilityState of states) {
    const unit = unitsByAvailability[availabilityState];

    expect(Value.Check(AvailabilityStateSchema, availabilityState)).toBe(true);
    expect(Value.Check(UnitSchema, unit)).toBe(true);
    expect(Value.Check(UnitSchema, roundTrip(unit))).toBe(true);
  }
});

test("a program with an unknown sobriety policy still validates honestly", () => {
  const sobrietyNotPubliclyListed = aProgram().withUnknownSobrietyPolicy().build();

  expect(sobrietyNotPubliclyListed.sobrietyRequired).toBe("unknown");
  expect(Value.Check(ProgramSchema, sobrietyNotPubliclyListed)).toBe(true);
  expect(Value.Check(ProgramSchema, roundTrip(sobrietyNotPubliclyListed))).toBe(true);
});

test("a provider without listed contacts stays optional, never fabricated", () => {
  const unlisted = aProvider().withoutContactDetails().build();

  expect(unlisted.phone).toBeUndefined();
  expect(Value.Check(ProviderSchema, unlisted)).toBe(true);
  expect(Value.Check(ProviderSchema, roundTrip(unlisted))).toBe(true);
});

test("rejects a unit whose coordinates are null", () => {
  const approximateShaped = { ...aUnit().build(), coordinates: null };

  expect(Value.Check(UnitSchema, approximateShaped)).toBe(false);
});

test("rejects a unit without coordinates", () => {
  const withoutCoordinates: Record<string, unknown> = { ...aUnit().build() };
  delete withoutCoordinates.coordinates;

  expect(Value.Check(UnitSchema, withoutCoordinates)).toBe(false);
});

test("unit size carries both square footage and room type", () => {
  const size = { squareFeet: 350, roomType: "shared-room" };

  expect(Value.Check(UnitSizeSchema, size)).toBe(true);
  expect(Value.Check(RoomTypeSchema, "shared-room")).toBe(true);
  expect(Value.Check(UnitSizeSchema, roundTrip(size))).toBe(true);
});

test("all eight real DC wards are valid filter territory", () => {
  for (const ward of [1, 2, 3, 4, 5, 6, 7, 8]) {
    expect(Value.Check(WardSchema, ward)).toBe(true);
  }

  expect(Value.Check(WardSchema, 0)).toBe(false);
  expect(Value.Check(WardSchema, 9)).toBe(false);
});

test("eligibility fields unknown to the source stay unknown through a JSON round-trip", () => {
  const unlisted = aProgram()
    .withUnknownHousingType()
    .withUnknownLengthOfStay()
    .withUnknownPopulation()
    .withUnknownGender()
    .build();

  expect(unlisted.housingType).toBe("unknown");
  expect(unlisted.lengthOfStay).toBe("unknown");
  expect(unlisted.population).toBe("unknown");
  expect(unlisted.gender).toBe("unknown");
  expect(Value.Check(ProgramSchema, unlisted)).toBe(true);

  const back = roundTrip(unlisted) as Program;
  expect(back.population).toBe("unknown");
  expect(back.gender).toBe("unknown");
  expect(Value.Check(ProgramSchema, back)).toBe(true);
});

test("a provider website is a web URL at the contract layer", () => {
  const listed = aProvider().build();
  expect(Value.Check(ProviderSchema, { ...listed, website: "https://shelter.example" })).toBe(true);
  expect(Value.Check(ProviderSchema, { ...listed, website: "http://shelter.example" })).toBe(true);
  expect(Value.Check(ProviderSchema, { ...listed, website: "javascript:alert(0)" })).toBe(false);
});

test("entity consumers tolerate future fields", () => {
  const evolved = { futureField: { note: "a contract revision added this" } };

  expect(Value.Check(UnitSchema, { ...aUnit().build(), ...evolved })).toBe(true);
  expect(Value.Check(ProgramSchema, { ...aProgram().build(), ...evolved })).toBe(true);
  expect(Value.Check(ProviderSchema, { ...aProvider().build(), ...evolved })).toBe(true);
});

test("malformed units fail validation", () => {
  expect(Value.Check(UnitSchema, { ...aUnit().build(), ward: 12 })).toBe(false);
  expect(
    Value.Check(UnitSchema, { ...aUnit().build(), availabilityState: "maybe-available" }),
  ).toBe(false);
  expect(Value.Check(UnitSchema, { ...aUnit().build(), address: "" })).toBe(false);
});
