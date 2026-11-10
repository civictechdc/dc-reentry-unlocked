import { expect, test } from "vitest";
import { Value } from "typebox/value";
import type { Program } from "./index";
import {
  AvailabilityStateSchema,
  ProgramSchema,
  ProviderSchema,
  RoomTypeSchema,
  UnitSizeSchema,
  UnitSchema,
  WardSchema,
} from "./index";
import { aProvider, aProgram } from "./testing";

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

const aUnitEntity = (
  overrides?: Partial<{
    ward: number;
    availabilityState: "available" | "not-available" | "unverified-availability";
    availabilityConfirmed: boolean;
  }>,
) => ({
  id: "unit-1",
  programId: "program-1",
  address: "1440 Test Street NW",
  ward: overrides?.ward ?? 5,
  quadrant: "NW",
  coordinates: { latitude: 38.913, longitude: -77.032 },
  bedrooms: 1,
  size: { squareFeet: 400, roomType: "efficiency" },
  cost: 650,
  availabilityState: overrides?.availabilityState ?? "available",
  availabilityConfirmed: overrides?.availabilityConfirmed ?? true,
});

test("every tri-state availability state survives a JSON round-trip", () => {
  const states = ["available", "not-available", "unverified-availability"] as const;

  for (const availabilityState of states) {
    const unit = aUnitEntity({ availabilityState });

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
  const approximateShaped = { ...aUnitEntity(), coordinates: null };

  expect(Value.Check(UnitSchema, approximateShaped)).toBe(false);
});

test("rejects a unit without coordinates", () => {
  const withoutCoordinates: Record<string, unknown> = { ...aUnitEntity() };
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

  expect(Value.Check(UnitSchema, { ...aUnitEntity(), ...evolved })).toBe(true);
  expect(Value.Check(ProgramSchema, { ...aProgram().build(), ...evolved })).toBe(true);
  expect(Value.Check(ProviderSchema, { ...aProvider().build(), ...evolved })).toBe(true);
});

test("malformed units fail validation", () => {
  expect(Value.Check(UnitSchema, { ...aUnitEntity(), ward: 12 })).toBe(false);
  expect(Value.Check(UnitSchema, { ...aUnitEntity(), availabilityState: "maybe-available" })).toBe(
    false,
  );
  expect(Value.Check(UnitSchema, { ...aUnitEntity(), address: "" })).toBe(false);
});
