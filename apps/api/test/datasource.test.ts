import { Value, UnitsResponseSchema, UnitCardSchema, type UnitCard } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { expect, test } from "vitest";
import {
  createDatasetHousingUnitsSource,
  createMemoryHousingUnitsSource,
  defaultDatasetPath,
} from "../src/datasource";
import { buildApp } from "../src/app";

test("the running API serves only the available units of the frozen dataset", async () => {
  const source = await createDatasetHousingUnitsSource(defaultDatasetPath());
  const app = await buildApp({ unitSource: source, logLevel: "error" });

  const response = await app.inject("/units");
  const payload = response.json();

  expect(response.statusCode).toBe(200);
  expect(payload.units.length).toBe(919); // 1200 dataset units − not-available − unverified-availability
  expect(Value.Check(UnitsResponseSchema, payload)).toBe(true);
  expect(payload.units.every((unit: UnitCard) => unit.availabilityState === "available")).toBe(
    true,
  );
  expect(payload.units.every((unit: UnitCard) => Value.Check(UnitCardSchema, unit))).toBe(true);

  await app.close();
});

test("the data source is swappable: an injected dataset serves its available units", async () => {
  const source = createMemoryHousingUnitsSource([
    aUnit().withId("u1").inWard(1).build(),
    aUnit().withId("u2").build(),
  ]);
  const app = await buildApp({ unitSource: source, logLevel: "error" });

  const response = await app.inject("/units");
  const ids = response.json().units.map((unit: UnitCard) => unit.id);

  expect(ids).toEqual(["u1", "u2"]);
  await app.close();
});

test("unavailable and unverified-availability units never leave the data source", () => {
  const source = createMemoryHousingUnitsSource([
    aUnit().withId("available-1").build(),
    aUnit().withId("taken").unavailable().build(),
    aUnit().withId("hold").withUnverifiedAvailability().build(),
  ]);

  const ids = source.listUnits().map((unit) => unit.id);

  expect(ids).toEqual(["available-1"]);
  expect(ids).not.toContain("taken");
  expect(ids).not.toContain("hold");
});

test("available units keep the confirmation distinction: verified and needs-verification both surface", async () => {
  const source = await createDatasetHousingUnitsSource(defaultDatasetPath());
  const badges = new Set(source.listUnits().map((unit) => unit.verificationBadge));

  expect(badges).toContain("confirmed");
  expect(badges).toContain("needs-verification");
});
