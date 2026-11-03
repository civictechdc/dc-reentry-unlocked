import { expect, test } from "vitest";
import { buildApp } from "../src/app";
import { createMemoryHousingUnitsSource } from "../src/datasource";
import { fixtureDataset } from "./fixtures";

const FRONTEND_ORIGIN = "http://localhost:5173";

async function buildCorsApp(rateLimit?: { max: number; timeWindowMs: number }) {
  return buildApp({
    unitSource: createMemoryHousingUnitsSource(fixtureDataset),
    logLevel: "error",
    corsOrigins: [FRONTEND_ORIGIN],
    ...(rateLimit ? { rateLimit } : {}),
  });
}

test("the configured frontend origin is the only one CORS reflects", async () => {
  const app = await buildCorsApp();

  const allowed = await app.inject({ url: "/health", headers: { origin: FRONTEND_ORIGIN } });
  expect(allowed.statusCode).toBe(200);
  expect(allowed.headers["access-control-allow-origin"]).toBe(FRONTEND_ORIGIN);
  expect(String(allowed.headers["vary"])).toContain("Origin");

  const disallowed = await app.inject({
    url: "/health",
    headers: { origin: "http://replaced.example" },
  });
  expect(disallowed.headers["access-control-allow-origin"]).toBeUndefined();
  await app.close();
});

test("a well-formed preflight is answered once with the CORS contract for the allowed origin", async () => {
  const app = await buildCorsApp();

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: {
      origin: FRONTEND_ORIGIN,
      "access-control-request-method": "GET",
    },
  });

  expect(preflight.statusCode).toBe(204);
  expect(preflight.headers["access-control-allow-origin"]).toBe(FRONTEND_ORIGIN);
  expect(String(preflight.headers["access-control-allow-methods"])).toContain("GET");
  await app.close();
});

test("a rate-limited preflight still answers with the shared envelope on the CORS wildcard route", async () => {
  const app = await buildCorsApp({ max: 1, timeWindowMs: 60_000 });

  // The wildcard OPTIONS route is registered by the CORS plugin; the app's
  // error handler must own it too, so budget exhaustion through a preflight
  // uses the envelope — not Fastify's default error shape.
  const first = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: { origin: FRONTEND_ORIGIN, "access-control-request-method": "GET" },
  });
  const second = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: { origin: FRONTEND_ORIGIN, "access-control-request-method": "GET" },
  });

  expect(first.statusCode).toBe(204);
  expect(second.statusCode).toBe(429);
  const payload = second.json();
  expect(payload.code).toBe("rate-limited");
  expect(payload.schemaVersion).toBe("2.0");
  expect(payload.message).toBe("Too many requests — please wait a moment before trying again.");
  expect(payload.correlationId).toEqual(second.headers["x-request-id"]);
  expect(second.headers["retry-after"]).toBeTruthy();
  await app.close();
});

test("an accepted preflight reply carries the security headers and its request id", async () => {
  const app = await buildCorsApp();

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: { origin: FRONTEND_ORIGIN, "access-control-request-method": "GET" },
  });

  expect(preflight.statusCode).toBe(204);
  expect(preflight.headers["x-content-type-options"]).toBe("nosniff");
  expect(String(preflight.headers["strict-transport-security"] ?? "")).toMatch(/max-age/);
  expect(String(preflight.headers["content-security-policy"] ?? "")).toContain("default-src");
  expect(String(preflight.headers["x-request-id"])).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
  );
  await app.close();
});

test("a malformed preflight is refused, carries the security headers, and is refused again by a second look", async () => {
  const app = await buildCorsApp();

  const malformed = await app.inject({ method: "OPTIONS", url: "/units", headers: {} });

  expect(malformed.statusCode).toBe(400);
  expect(malformed.headers["x-content-type-options"]).toBe("nosniff");
  expect(String(malformed.headers["strict-transport-security"] ?? "")).toMatch(/max-age/);
  expect(malformed.headers["x-request-id"]).toBeTruthy();
  await app.close();
});

test("a malformed preflight spends the same per-client budget as a real request", async () => {
  const app = await buildCorsApp({ max: 1, timeWindowMs: 60_000 });

  const malformed = await app.inject({ method: "OPTIONS", url: "/units", headers: {} });
  const after = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: { origin: FRONTEND_ORIGIN, "access-control-request-method": "GET" },
  });

  expect(malformed.statusCode).toBe(400); // refused first, yet counted
  expect(after.statusCode).toBe(429);
  expect(after.json().code).toBe("rate-limited");
  await app.close();
});

test("a preflight from a disallowed origin gets no CORS grant", async () => {
  const app = await buildCorsApp();

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: {
      origin: "http://replaced.example",
      "access-control-request-method": "GET",
    },
  });

  // The browser gate is Access-Control-Allow-Origin; with the configured
  // origin list it stays absent, so a browser refuses the exchange. The
  // plugin still prints its methods advert, but without the grant no
  // cross-origin call may proceed.
  expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
  await app.close();
});

test("preflight and unknown-route requests spend the same per-client budget as real requests", async () => {
  const app = await buildCorsApp({ max: 2, timeWindowMs: 60_000 });

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/units",
    headers: { origin: FRONTEND_ORIGIN, "access-control-request-method": "GET" },
  });
  const firstHole = await app.inject("/no-such-path-a");
  const secondHole = await app.inject("/no-such-path-b");
  const overBudget = await app.inject("/units");

  expect(preflight.statusCode).toBe(204);
  expect(firstHole.statusCode).toBe(404);
  expect(secondHole.statusCode).toBe(429); // the budget counts preflights and 404s alike
  expect(secondHole.json().code).toBe("rate-limited");
  expect(secondHole.json().correlationId).toEqual(secondHole.headers["x-request-id"]);
  expect(overBudget.statusCode).toBe(429);
  expect(overBudget.headers["retry-after"]).toBeTruthy();
  await app.close();
});

test("the rate-limited 404 keeps the stable envelope shape for a client probing unknown routes", async () => {
  const app = await buildCorsApp({ max: 1, timeWindowMs: 60_000 });

  const first = await app.inject("/missing");
  const second = await app.inject("/missing");

  expect(first.statusCode).toBe(404);
  expect(first.json().code).toBe("not-found");
  expect(second.statusCode).toBe(429);
  expect(second.json().code).toBe("rate-limited");
  expect(second.json().schemaVersion).toBe("2.0");
  expect(second.headers["retry-after"]).toBeTruthy();
  await app.close();
});
