import { expect, test } from "vitest";
import { Value } from "typebox/value";
import type { UnitCard } from "./index";
import { UnitCardSchema } from "./index";
import { aUnit } from "./testing";

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

const sampleCard = () =>
  aUnit().inWard(5).withUnknownSobrietyPolicy().atOrganization("Fresh Start Housing").build();

test("a built unit card passes schema conformance", () => {
  const card = sampleCard();

  expect(Value.Check(UnitCardSchema, card)).toBe(true);
});

test("a built unit card survives a JSON round-trip", () => {
  const card = roundTrip(sampleCard());

  expect(Value.Check(UnitCardSchema, card)).toBe(true);
});

test("program policies and provider contacts ride along without further lookups", () => {
  const card = sampleCard();

  expect(card.program.sobrietyRequired).toBe("unknown");
  expect(card.provider.organization).toBe("Fresh Start Housing");
  expect(card.program.name).toBe("Fresh Start Transitional");
});

test("available-but-unconfirmed units carry the needs-verification badge", () => {
  const needingVerification = aUnit().available().needsVerification().build();

  expect(needingVerification.availabilityState).toBe("available");
  expect(needingVerification.availabilityConfirmed).toBe(false);
  expect(needingVerification.verificationBadge).toBe("needs-verification");

  const confirmed = aUnit().available().confirmed().build();
  expect(confirmed.availabilityState).toBe("available");
  expect(confirmed.availabilityConfirmed).toBe(true);
  expect(confirmed.verificationBadge).toBe("confirmed");
});

test("built cards distinguish all three availability states observably", () => {
  const cards: readonly UnitCard[] = [
    aUnit().available().build(),
    aUnit().unavailable().build(),
    aUnit().withUnverifiedAvailability().build(),
  ];

  expect(cards.map((c) => c.availabilityState)).toEqual([
    "available",
    "not-available",
    "unverified-availability",
  ]);

  for (const card of cards) {
    expect(Value.Check(UnitCardSchema, card)).toBe(true);
  }
});

test("a builder walks all three availability states under its own control", () => {
  const builder = aUnit()
    .unavailable()
    .available()
    .withUnverifiedAvailability()
    .available()
    .build();

  expect(builder.availabilityState).toBe("available");
});

test("an eligibility field that is not publicly listed rides the card honestly", () => {
  const card = aUnit().withUnknownPopulation().build();

  expect(card.program.population).toBe("unknown");
  expect(Value.Check(UnitCardSchema, card)).toBe(true);
});

test("two cards built from one builder never share nested fixtures", () => {
  const builder = aUnit();
  const first = builder.build();
  first.program.referralRequired = "yes";
  first.provider.organization = "Renamed Clinic";
  const second = builder.build();

  expect(second.program.referralRequired).toBe("no");
  expect(second.provider.organization).toBe("Fresh Start Housing");
  expect(first.program).not.toBe(second.program);
  expect(first.provider).not.toBe(second.provider);
});

test("the tested card builder becomes exact again only through re-confirmed coordinates", () => {
  expect(() =>
    aUnit().withApproximateLocation().withExactAddress("1440 Test Street NW").build(),
  ).toThrow();

  const reconfirmed = aUnit()
    .withApproximateLocation()
    .withCoordinates(38.913, -77.032)
    .withExactAddress("1440 Test Street NW")
    .build();

  expect(reconfirmed.locationPrecision).toBe("exact");
  expect(reconfirmed.coordinates).not.toBeNull();
  expect(Value.Check(UnitCardSchema, reconfirmed)).toBe(true);
});

test("a future field on the card is ignorable by old consumers", () => {
  const card = sampleCard();

  expect(Value.Check(UnitCardSchema, card)).toBe(true);

  const evolved = {
    ...card,
    transitNotes: "future field — must not break old consumers",
  };

  expect(Value.Check(UnitCardSchema, evolved)).toBe(true);
});

test("a card whose program is not a program object fails validation", () => {
  const broken = roundTrip(sampleCard()) as UnitCard;

  expect(Value.Check(UnitCardSchema, { ...broken, program: "provided" })).toBe(false);
});
