import { UNIT_FILTERS, type FilterDefinition } from "@dc-reentry/shared";
import { expect, test } from "vitest";
import { buildApp } from "../src/app";
import { createMemoryHousingUnitsSource } from "../src/datasource";

test("the filter-schema endpoint serves the shared definitions exactly", async () => {
  const app = await buildApp({
    unitSource: createMemoryHousingUnitsSource([]),
    logLevel: "error",
  });

  const response = await app.inject("/filters");
  const payload = response.json();

  expect(response.statusCode).toBe(200);
  expect(payload).toEqual({ schemaVersion: "0.2", filters: UNIT_FILTERS });
  expect(payload.filters).toEqual(UNIT_FILTERS);

  await app.close();
});

test("the published schema is the pinned eleven-filter set over three controls", async () => {
  const app = await buildApp({
    unitSource: createMemoryHousingUnitsSource([]),
    logLevel: "error",
  });

  const response = await app.inject("/filters");
  const filters = response.json().filters as FilterDefinition[];

  expect(filters.length).toBe(11);
  expect(filters.filter((definition) => definition.control === "boolean").length).toBe(6);
  expect(filters.filter((definition) => definition.control === "single-select").length).toBe(4);
  expect(filters.filter((definition) => definition.control === "multi-select").length).toBe(1);

  await app.close();
});
