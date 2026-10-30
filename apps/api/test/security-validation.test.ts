import { expect, test } from "vitest";
import { buildApp } from "../src/app";
import { createMemoryHousingUnitsSource } from "../src/datasource";
import { aUnit } from "@dc-reentry/shared/testing";

async function buildSecuredApp() {
  return buildApp({
    unitSource: createMemoryHousingUnitsSource([aUnit().build()]),
    logLevel: "error",
  });
}

test("every response carries the baseline security headers from helmet", async () => {
  const app = await buildSecuredApp();

  const response = await app.inject("/units");

  expect(response.headers["x-content-type-options"]).toBe("nosniff");
  expect(String(response.headers["strict-transport-security"] ?? "")).toMatch(/max-age/);
  expect(String(response.headers["content-security-policy"] ?? "")).toContain("default-src");
  await app.close();
});

test("health and error responses are secured the same way", async () => {
  const app = await buildSecuredApp();

  const healthy = await app.inject("/health");
  const refused = await app.inject("/units?sobriety=maybe");
  const missing = await app.inject("/nothing-here");

  for (const response of [healthy, refused, missing]) {
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(String(response.headers["strict-transport-security"] ?? "")).toMatch(/max-age/);
  }
  await app.close();
});

test("malformed and out-of-range filter values are rejected with the stable envelope", async () => {
  const app = await buildSecuredApp();

  const notANumber = await app.inject("/units?ward=abc");
  const outOfRange = await app.inject("/units?ward=0");
  const aboveWards = await app.inject("/units?ward=9");
  const junkEnum = await app.inject("/units?length-of-stay=forever");

  for (const response of [notANumber, outOfRange, aboveWards, junkEnum]) {
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("invalid-filter");
    expect(response.json().correlationId).toEqual(response.headers["x-request-id"]);
  }
  await app.close();
});
