import { Value, UnitsResponseSchema, type UnitCard } from "@dc-reentry/shared";
import { expect, test } from "vitest";
import { buildApp } from "../src/app";
import { createMemoryHousingUnitsSource } from "../src/datasource";
import { fixtureDataset } from "./fixtures";

const buildUnitsApp = () =>
  buildApp({
    unitSource: createMemoryHousingUnitsSource(fixtureDataset),
    logLevel: "error",
  });

test("a listing without filters returns every available unit and conveys the contract version", async () => {
  const app = await buildUnitsApp();

  const response = await app.inject("/units");
  const payload = response.json();

  expect(response.statusCode).toBe(200);
  expect(payload.schemaVersion).toBe("0.2");
  expect(payload.units.length).toBe(fixtureDataset.length - 4); // two taken, two holds
  expect(payload.units.map((unit: UnitCard) => unit.availabilityState)).not.toContain(
    "not-available",
  );
  expect(Value.Check(UnitsResponseSchema, payload)).toBe(true);
  await app.close();
});

test("excluding unavailable units keeps confirmed and needs-verification units side by side", async () => {
  const app = await buildUnitsApp();

  const payload = (await app.inject("/units")).json();
  const badges = payload.units.map((unit: UnitCard) => unit.verificationBadge);

  expect(badges).toContain("confirmed");
  expect(badges).toContain("needs-verification");
  await app.close();
});

test("units with an unknown referral policy are included when the filter is referral-required=no", async () => {
  const app = await buildUnitsApp();

  const response = await app.inject("/units?referral-required=no");
  const ids = response.json().units.map((unit: UnitCard) => unit.id);

  expect(response.statusCode).toBe(200);
  expect(ids).toContain("referral-unknown");
  expect(ids).not.toContain("referral-required");
  await app.close();
});

test("units whose referral policy is unknown are excluded when the filter is referral-required=yes", async () => {
  const app = await buildUnitsApp();

  const ids = (await app.inject("/units?referral-required=yes"))
    .json()
    .units.map((unit: UnitCard) => unit.id);

  expect(ids).toContain("referral-required");
  expect(ids).not.toContain("referral-unknown");
  await app.close();
});

test("an unknown sobriety policy acts like no when the filter is sobriety=no", async () => {
  const app = await buildUnitsApp();

  const ids = (await app.inject("/units?sobriety=no")).json().units.map((u: UnitCard) => u.id);

  expect(ids).toContain("sobriety-unknown");
  expect(ids).not.toContain("sobriety-required"); // known yes
  await app.close();
});

test("an unknown population is a match for every population selection and stays marked as not publicly listed", async () => {
  const app = await buildUnitsApp();

  for (const selection of ["individuals", "families", "both"]) {
    const payload = (await app.inject(`/units?population=${selection}`)).json();
    const match = payload.units.find((unit: UnitCard) => unit.id === "population-unknown");

    expect(match, `population-unknown should surface for population=${selection}`).toBeTruthy();
    expect(match?.program.population).toBe("unknown"); // the retained honest marker
  }
  await app.close();
});

test("an unknown gender is a match for every gender selection", async () => {
  const app = await buildUnitsApp();

  const ids = (await app.inject("/units?gender=men")).json().units.map((u: UnitCard) => u.id);
  expect(ids).toContain("gender-unknown");
  expect(ids).not.toContain("women-only");

  await app.close();
});

test("unknown housing type and length of stay match their respective enum selections", async () => {
  const app = await buildUnitsApp();

  const housingType = (await app.inject("/units?housing-type=market-rate"))
    .json()
    .units.map((u: UnitCard) => u.id);
  expect(housingType).toContain("housing-type-unknown");

  const stay = (await app.inject("/units?length-of-stay=permanent-open-ended"))
    .json()
    .units.map((u: UnitCard) => u.id);
  expect(stay).toContain("stay-unknown");
  await app.close();
});

test("ward selections match ward membership across multiple wards", async () => {
  const app = await buildUnitsApp();

  const id = (await app.inject("/units?ward=1&ward=2")).json().units.map((u: UnitCard) => u.id);
  expect(id).toContain("verified-exact-nw");
  expect(id).toContain("unconfirmed-ne");
  expect(id).not.toContain("women-only"); // ward 7
  expect(id).not.toContain("taken-unit"); // ward 1 but not available
  await app.close();
});

test("filter combinations narrow conjunctively across filters and union within one filter", async () => {
  const app = await buildUnitsApp();

  // ward 1 OR ward 8, referral no-or-unknown: referral-unknown is ward 3 → excluded.
  const combo = (await app.inject("/units?ward=1&ward=8&referral-required=no"))
    .json()
    .units.map((u: UnitCard) => u.id);
  expect(combo).toContain("voucher-unknown"); // ward 1, voucher unknown → matches no
  expect(combo).not.toContain("referral-unknown"); // ward 3
  expect(combo).not.toContain("taken-unit"); // ward 1, unavailable

  // Both yes and no on referral is the union of both matches: every
  // policy state stays, unknowns included (never fabricated as yes).
  const bothWays = (await app.inject("/units?referral-required=yes&referral-required=no"))
    .json()
    .units.map((u: UnitCard) => u.id)
    .sort();
  const unfiltered = (await app.inject("/units"))
    .json()
    .units.map((u: UnitCard) => u.id)
    .sort();
  expect(bothWays).toEqual(unfiltered);
  await app.close();
});

test("unrecognized filter names and malformed values are rejected as invalid filters", async () => {
  const app = await buildUnitsApp();

  const unknownName = await app.inject("/units?referral-required-status=no");
  expect(unknownName.statusCode).toBe(400);
  expect(unknownName.json().code).toBe("invalid-filter");

  const badEnum = await app.inject("/units?housing-type=floating-castle");
  expect(badEnum.statusCode).toBe(400);
  expect(badEnum.json().code).toBe("invalid-filter");

  const badWard = await app.inject("/units?ward=9");
  expect(badWard.statusCode).toBe(400);
  expect(badWard.json().code).toBe("invalid-filter");

  const badBoolean = await app.inject("/units?sobriety=maybe");
  expect(badBoolean.statusCode).toBe(400);
  expect(badBoolean.json().code).toBe("invalid-filter");
  await app.close();
});

test("straight enum selections match their exact taxonomy values from the shared definitions", async () => {
  const app = await buildUnitsApp();

  const families = (await app.inject("/units?population=families"))
    .json()
    .units.map((u: UnitCard) => u.id);
  expect(families).toEqual(["population-unknown"]);

  const both = (await app.inject("/units?population=both"))
    .json()
    .units.map((u: UnitCard) => u.id)
    .sort();
  expect(both).toEqual(["families-both", "population-unknown"]);

  const women = (await app.inject("/units?gender=women"))
    .json()
    .units.map((u: UnitCard) => u.id)
    .sort();
  expect(women).toEqual(["gender-unknown", "women-only"]);
  await app.close();
});

test("every boolean filter behaves the same: yes keeps known yes only, no keeps no and unknown", async () => {
  const app = await buildUnitsApp();

  const booleanPolicies = [
    ["referral-required", "referral-required", "referral-unknown"],
    ["sobriety", "sobriety-required", "sobriety-unknown"],
    ["background-check", "background-check-required", "background-check-unknown"],
    ["sex-offense-restrictions", "sex-offense-restricted", "sex-offense-unknown"],
    ["treatment", "treatment-required", "treatment-unknown"],
    ["housing-vouchers", "vouchers-accepted", "voucher-unknown"],
  ] as const;

  for (const [paramName, yesUnitId, unknownUnitId] of booleanPolicies) {
    const yesIds = (await app.inject(`/units?${paramName}=yes`))
      .json()
      .units.map((unit: UnitCard) => unit.id);
    expect(yesIds, `${paramName}=yes keeps the known yes`).toContain(yesUnitId);
    expect(yesIds, `${paramName}=yes never invents a yes for unknown`).not.toContain(unknownUnitId);

    const noIds = (await app.inject(`/units?${paramName}=no`))
      .json()
      .units.map((unit: UnitCard) => unit.id);
    expect(noIds, `${paramName}=no keeps the unknown policy`).toContain(unknownUnitId);
    expect(noIds, `${paramName}=no rejects the known yes`).not.toContain(yesUnitId);
  }
  await app.close();
});

test("the served openapi document carries the provenance marker fields", async () => {
  const app = await buildApp({
    logLevel: "error",
    unitSource: createMemoryHousingUnitsSource(fixtureDataset),
  });

  const doc = (await app.inject("/openapi.json")).json() as {
    paths: { "/units"?: { get?: { responses?: Record<string, unknown> } } };
  };
  const ok = doc.paths["/units"]?.get?.responses?.[200] as
    | {
        content: {
          "application/json": { schema: { properties: Record<string, unknown> } };
        };
      }
    | undefined;
  const properties = ok?.content["application/json"].schema.properties ?? {};

  expect(Object.keys(properties)).toContain("synthetic");
  expect(Object.keys(properties)).toContain("disclosure");

  await app.close();
});
