import { fc, test as fcTest } from "@fast-check/vitest";
import { expect } from "vitest";
import { Value } from "typebox/value";
import type { UnitCard } from "./index";
import { UnitCardSchema, UnitSchema } from "./index";
import { aUnitCard } from "./testing";

/**
 * Property-based conformance and round-trip for unit payloads. The arbitrary
 * generators build payloads straight from the domain constraints — coordinates
 * always present and exact, never a precision field — so any drift between the
 * fluent builders and the schemas (or any nullability regression) surfaces as
 * a shrunk counterexample, not a hand-picked case.
 */

/** DC-bounded exact coordinates; the contract requires them on every unit. */
const coordinatesArb = fc.record({
  latitude: fc.double({ min: 38.79, max: 38.99, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: -77.12, max: -76.9, noNaN: true, noDefaultInfinity: true }),
});

const cardFieldsArb = fc.record({
  address: fc.string({ minLength: 1, maxLength: 60 }),
  ward: fc.integer({ min: 1, max: 8 }),
  quadrant: fc.constantFrom("NW", "NE", "SW", "SE"),
  coordinates: coordinatesArb,
  bedrooms: fc.integer({ min: 0, max: 6 }),
  squareFeet: fc.integer({ min: 150, max: 2000 }),
  cost: fc.integer({ min: 0, max: 4000 }),
});

const cardFromFields = (fields: {
  address: string;
  ward: number;
  quadrant: "NW" | "NE" | "SW" | "SE";
  coordinates: { latitude: number; longitude: number };
  bedrooms: number;
  squareFeet: number;
  cost: number;
}): UnitCard =>
  aUnitCard()
    .inWard(fields.ward)
    .inQuadrant(fields.quadrant)
    .withExactAddress(fields.address)
    .withCoordinates(fields.coordinates.latitude, fields.coordinates.longitude)
    .withBedrooms(fields.bedrooms)
    .withSquareFeet(fields.squareFeet)
    .withCost(fields.cost)
    .build();

/** The unit fields a card flattens, written from the unit contract directly. */
const unitFromCard = (card: UnitCard) => ({
  id: card.id,
  programId: card.programId,
  address: card.address,
  ward: card.ward,
  quadrant: card.quadrant,
  coordinates: card.coordinates,
  bedrooms: card.bedrooms,
  size: card.size,
  cost: card.cost,
  availabilityState: card.availabilityState,
  availabilityConfirmed: card.availabilityConfirmed,
});

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

fcTest.prop({ fields: cardFieldsArb }, { numRuns: 100 })(
  "every generated unit card conforms to the card schema",
  ({ fields }) => {
    expect(Value.Check(UnitCardSchema, cardFromFields(fields))).toBe(true);
  },
);

fcTest.prop({ fields: cardFieldsArb }, { numRuns: 100 })(
  "every generated unit conforms to the unit schema",
  ({ fields }) => {
    expect(Value.Check(UnitSchema, unitFromCard(cardFromFields(fields)))).toBe(true);
  },
);

fcTest.prop({ fields: cardFieldsArb }, { numRuns: 100 })(
  "every generated unit and card is preserved by a JSON round-trip",
  ({ fields }) => {
    const card = cardFromFields(fields);
    const unit = unitFromCard(card);

    expect(roundTrip(card)).toEqual(card);
    expect(roundTrip(unit)).toEqual(unit);
    expect(Value.Check(UnitCardSchema, roundTrip(card))).toBe(true);
    expect(Value.Check(UnitSchema, roundTrip(unit))).toBe(true);
  },
);
