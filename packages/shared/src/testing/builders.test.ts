import { expect, test } from "vitest";
import {
  POLICY_STATES,
  PolicyStateSchema,
  ProgramSchema,
  type Program,
  type UnitCard,
} from "@dc-reentry/shared";
import { DELEGABLE_PROGRAM_FIELDS, aProgram, aUnit, aUnitCard } from "@dc-reentry/shared/testing";

const programSchemaFields = Object.keys(ProgramSchema.properties);
const programProperty = (field: string): unknown =>
  (ProgramSchema.properties as Record<string, unknown>)[field];

/**
 * A property is a policy field when the schema uses `PolicyStateSchema`
 * directly (identity) or declares the same tri-state enum structurally —
 * the fallback keeps the guard honest if the schema ever wraps the enum.
 */
const isPolicyStateProperty = (property: unknown): boolean => {
  if (property === PolicyStateSchema) return true;
  const values =
    typeof property === "object" && property !== null && "enum" in property
      ? (property as { enum: readonly unknown[] }).enum
      : undefined;
  return (
    Array.isArray(values) &&
    values.length === POLICY_STATES.length &&
    POLICY_STATES.every((state) => values.includes(state))
  );
};

type BuildsSomething = { build(): unknown };

const invokeFluent = (builder: object, method: string, value?: string): BuildsSomething => {
  const installed = (builder as Record<string, unknown>)[method];
  expect(installed, `${method} should be installed on ${builder.constructor.name}`).toBeTypeOf(
    "function",
  );
  return (installed as (this: object, input?: string) => BuildsSomething).call(builder, value);
};

test("the delegation table covers exactly the policy fields the program schema declares", () => {
  const declaredBySchema = programSchemaFields
    .filter((field) => isPolicyStateProperty(programProperty(field)))
    .sort();
  const coveredByTable = DELEGABLE_PROGRAM_FIELDS.map((entry) => entry.field)
    .filter((field) => isPolicyStateProperty(programProperty(field)))
    .sort();

  expect(
    coveredByTable,
    "every policy field the program schema declares must have a delegable table entry",
  ).toEqual(declaredBySchema);
});

test("every delegation table entry names a program field the schema still declares", () => {
  const staleTableFields = DELEGABLE_PROGRAM_FIELDS.map((entry) => entry.field).filter(
    (field) => !programSchemaFields.includes(field),
  );

  expect(staleTableFields, "table entries whose program field no longer exists").toEqual([]);
});

test("every delegated program field drives the program and the card builders the same way", () => {
  for (const entry of DELEGABLE_PROGRAM_FIELDS) {
    const withMethod = `with${entry.stem}`;
    const withUnknownMethod = `withUnknown${entry.stem}`;

    const statedFromProgram = invokeFluent(aProgram(), withMethod, entry.sample).build() as Program;
    const statedFromCard = (invokeFluent(aUnitCard(), withMethod, entry.sample).build() as UnitCard)
      .program;

    expect(statedFromProgram[entry.field], `${withMethod} writes ${entry.field}`).toBe(
      entry.sample,
    );
    expect(
      statedFromCard[entry.field],
      `${withMethod} writes ${entry.field} through the card`,
    ).toBe(entry.sample);

    const unknownFromProgram = invokeFluent(aProgram(), withUnknownMethod).build() as Program;
    const unknownFromCard = (invokeFluent(aUnitCard(), withUnknownMethod).build() as UnitCard)
      .program;

    expect(
      unknownFromProgram[entry.field],
      `${withUnknownMethod} keeps the honest unknown on the program builder`,
    ).toBe("unknown");
    expect(
      unknownFromCard[entry.field],
      `${withUnknownMethod} keeps the honest unknown on the card builder`,
    ).toBe("unknown");
  }
});

test("delegates a stated sobriety policy from the card builder to the embedded program", () => {
  const card = aUnitCard().withSobrietyPolicy("yes").build();

  expect(card.program.sobrietyRequired).toBe("yes");
});

test("delegates unknown sobriety policy from the card builder to the embedded program", () => {
  const card = aUnitCard().withUnknownSobrietyPolicy().build();

  expect(card.program.sobrietyRequired).toBe("unknown");
});

test("a unit entity builds fluently across its unit-level vocabulary", () => {
  const unit = aUnit()
    .withId("u-77")
    .inWard(7)
    .inQuadrant("SE")
    .withExactAddress("900 Test Avenue SE")
    .withCoordinates(38.88, -76.99)
    .withBedrooms(2)
    .withRoomType("apartment")
    .withSquareFeet(720)
    .withCost(925)
    .unavailable()
    .needsVerification()
    .build();

  expect(unit.id).toBe("u-77");
  expect(unit.ward).toBe(7);
  expect(unit.quadrant).toBe("SE");
  expect(unit.address).toBe("900 Test Avenue SE");
  expect(unit.coordinates).toEqual({ latitude: 38.88, longitude: -76.99 });
  expect(unit.bedrooms).toBe(2);
  expect(unit.size).toEqual({ squareFeet: 720, roomType: "apartment" });
  expect(unit.cost).toBe(925);
  expect(unit.availabilityState).toBe("not-available");
  expect(unit.availabilityConfirmed).toBe(false);
});

test("a unit tracks its availability and confirmation states fluently", () => {
  const listed = aUnit().available().confirmed().build();
  const unverified = aUnit().withUnverifiedAvailability().needsVerification().build();
  const withdrawn = aUnit().unavailable().build();

  expect(listed.availabilityState).toBe("available");
  expect(listed.availabilityConfirmed).toBe(true);
  expect(unverified.availabilityState).toBe("unverified-availability");
  expect(unverified.availabilityConfirmed).toBe(false);
  expect(withdrawn.availabilityState).toBe("not-available");
});

test("a unit composes id-consistently with its program out of the box", () => {
  const unit = aUnit().build();
  const program = aProgram().build();

  expect(unit.programId).toBe(program.id);
});

test("a unit points at the program it is arranged against", () => {
  const unit = aUnit().withProgramId("program-77").build();

  expect(unit.programId).toBe("program-77");
});

test("the escape hatch sets program fields that have no fluent form yet", () => {
  const card = aUnitCard()
    .withProgram({
      name: "Columbia Heights Housing Program",
      applicationProcess: "Call the intake line to schedule an appointment.",
    })
    .build();

  expect(card.program.name).toBe("Columbia Heights Housing Program");
  expect(card.program.applicationProcess).toBe("Call the intake line to schedule an appointment.");
});

test("the escape hatch reaches the provider contact fields", () => {
  const card = aUnitCard()
    .withProvider({ phone: "(202) 555-0147", email: "intake@housingsource.example.org" })
    .build();

  expect(card.provider.phone).toBe("(202) 555-0147");
  expect(card.provider.email).toBe("intake@housingsource.example.org");
});
