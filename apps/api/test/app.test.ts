import { expect, test } from "vitest";
import { aUnit } from "@dc-reentry/shared/testing";
import { buildApp } from "../src/app";

async function buildTestApp() {
  const app = await buildApp({
    logLevel: "error",
    unitSource: {
      synthetic: true,
      disclosure: "Scratch disclosure sentence.",
      filterSchema: [],
      listUnits: () => [],
    },
    corsOrigins: ["http://localhost:5173"],
    rateLimit: { max: 1000, timeWindowMs: 60_000 },
  });
  return app;
}

test("the API boots and answers its health probe", async () => {
  const app = await buildTestApp();

  const response = await app.inject("/health");

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });
  expect(response.headers["x-request-id"]).toBeTruthy();

  await app.close();
});

test("a stub data source keeps serving its units through the app wiring", async () => {
  const card = aUnit().build();
  const disclosure = "Stub disclosure sentence — fictional data only.";
  const app = await buildApp({
    logLevel: "error",
    unitSource: {
      synthetic: true,
      disclosure,
      filterSchema: [],
      listUnits: () => [card],
    },
  });
  const response = await app.inject("/units");
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    schemaVersion: "1.0",
    synthetic: true,
    disclosure,
    units: [card],
  });
  await app.close();
});
