import pino from "pino";
import type { FastifyBaseLogger } from "fastify";
import { Writable } from "node:stream";
import { expect, test } from "vitest";
import { buildApp } from "../src/app";
import { createMemoryHousingUnitsSource } from "../src/datasource";
import { aUnit } from "@dc-reentry/shared/testing";

/** Captures pino's rendered JSON lines so log content can be asserted. */
function captureLogger(): { logger: FastifyBaseLogger; lines: Array<Record<string, unknown>> } {
  const lines: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      callback();
    },
  });
  return {
    logger: pino({ level: "info" }, stream) as unknown as FastifyBaseLogger,
    lines,
  };
}

async function buildCapturedApp(rateLimit?: { max: number; timeWindowMs: number }) {
  const captured = captureLogger();
  const app = await buildApp({
    unitSource: createMemoryHousingUnitsSource([aUnit().build()]),
    loggerInstance: captured.logger,
    ...(rateLimit ? { rateLimit } : {}),
  });
  return { ...captured, app };
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test("an unknown route answers with the stable not-found envelope and its correlation id", async () => {
  const { app } = await buildCapturedApp();

  const response = await app.inject("/no-such-route");
  const payload = response.json();

  expect(response.statusCode).toBe(404);
  expect(payload.code).toBe("not-found");
  expect(payload.schemaVersion).toBe("0.2");
  expect(payload.correlationId).toEqual(response.headers["x-request-id"]);
  expect(String(payload.correlationId)).toMatch(UUID_LIKE);
  await app.close();
});

test("a rejected request carries its correlation id through the envelope, the header, and the logs", async () => {
  const { app, lines } = await buildCapturedApp();

  const response = await app.inject("/units?sobriety=maybe");
  const payload = response.json();
  const correlationId = String(payload.correlationId);

  expect(response.statusCode).toBe(400);
  expect(payload.code).toBe("invalid-filter");
  expect(correlationId).toEqual(response.headers["x-request-id"]);
  expect(correlationId).toMatch(UUID_LIKE);

  const rejectionLines = lines.filter(
    (line) => line.reqId === correlationId && line.msg === "request rejected",
  );
  expect(rejectionLines.length).toBeGreaterThan(0);
  await app.close();
});

test("a client-supplied request id is never echoed: the server generates its own correlation ids", async () => {
  const { app } = await buildCapturedApp();

  const response = await app.inject({
    url: "/units?sobriety=maybe",
    headers: { "x-request-id": "attacker-controlled-id" },
  });

  expect(response.json().correlationId).not.toEqual("attacker-controlled-id");
  expect(String(response.headers["x-request-id"])).toMatch(UUID_LIKE);
  await app.close();
});

const SAFE_INTERNAL_MESSAGE = "Something went wrong serving this request. Please retry later.";

test("a server failure answers with the internal-error envelope while the real detail stays in server logs", async () => {
  const captured = captureLogger();
  const app = await buildApp({
    unitSource: {
      synthetic: true,
      disclosure: "Scratch disclosure sentence for the error path — fictional data only.",
      filterSchema: [],
      listUnits: () => {
        throw new Error("boom: privileged stack detail");
      },
    },
    loggerInstance: captured.logger as unknown as FastifyBaseLogger,
  });

  const response = await app.inject("/units");
  const payload = response.json();

  expect(response.statusCode).toBe(500);
  expect(payload.code).toBe("internal-error");
  expect(payload.message).toBe(SAFE_INTERNAL_MESSAGE);
  expect(response.body).not.toContain("boom");
  expect(response.body).not.toContain("privileged stack detail");

  const failureLines = captured.lines.filter(
    (line) => line.reqId === payload.correlationId && line.msg === "request failed",
  );
  expect(failureLines.length).toBe(1);
  expect(JSON.stringify(failureLines[0])).toContain("privileged stack detail");
  await app.close();
});

test("the default per-client request budget answers 429 with the envelope and Retry-After", async () => {
  const { app } = await buildCapturedApp({ max: 1, timeWindowMs: 60_000 });

  const first = await app.inject("/units");
  const second = await app.inject("/units");

  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(429);
  const payload = second.json();
  expect(payload.code).toBe("rate-limited");
  expect(payload.schemaVersion).toBe("0.2");
  expect(second.headers["retry-after"]).toBeTruthy();
  expect(second.headers["x-ratelimit-limit"]).toBe("1");
  expect(second.headers["x-ratelimit-remaining"]).toBe("0");
  expect(payload.correlationId).toEqual(second.headers["x-request-id"]);
  await app.close();
});
