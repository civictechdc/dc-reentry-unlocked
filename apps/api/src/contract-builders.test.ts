import { expect, test } from "vitest";
import { UnitCardSchema, Value } from "@dc-reentry/shared";
import { aProvider, aProgram, aUnit } from "@dc-reentry/shared/testing";

// Consumer-side proof that the shared fluent builders arrange fixtures in
// domain language — and that the built cards conform to the shared contract
// the API is responsible for serving.

test("api tests arrange a ward-5 unit with an unknown sobriety policy via the shared builder", () => {
  const card = aUnit().inWard(5).withUnknownSobrietyPolicy().build();

  expect(card.ward).toBe(5);
  expect(card.program.sobrietyRequired).toBe("unknown");
  expect(Value.Check(UnitCardSchema, card)).toBe(true);
});

test("a unit whose population is unknown still conforms to the card contract", () => {
  const card = aUnit().withUnknownPopulation().build();

  expect(card.program.population).toBe("unknown");
  expect(Value.Check(UnitCardSchema, card)).toBe(true);
});

test("provider and program entities can be arranged directly when the data layer needs them", () => {
  const provider = aProvider().withoutContactDetails().build();
  const program = aProgram().withHousingType("transitional").build();

  expect(provider.phone).toBeUndefined();
  expect(provider.website).toBeUndefined();
  expect(program.housingType).toBe("transitional");
});
