import { buildApp, createDatasetHousingUnitsSource, defaultDatasetPath } from "./index";

/**
 * Development server: environment-driven configuration around the app
 * factory. Runs under `pnpm dev` (tsx watch) in apps/api.
 */

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const logLevel = process.env.LOG_LEVEL ?? "info";
const corsOrigins = parseOrigins(process.env.API_CORS_ORIGINS ?? "http://localhost:5173");

/**
 * The wildcard is never an allowed origin: an explicit "*" entry is a boot
 * failure (fail closed, like an empty list), not an allow-all switch. Only
 * exact origins are configurable.
 */
function parseOrigins(raw: string): string[] {
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  const wildcard = origins.find((origin) => origin.includes("*"));
  if (wildcard !== undefined) {
    throw new Error(
      `API_CORS_ORIGINS must list exact origins; the wildcard "*" is rejected (got: ${wildcard})`,
    );
  }
  return origins;
}
const rateLimitMax = Number(process.env.API_RATE_LIMIT_MAX ?? 100);
const rateLimitTimeWindowMs = Number(process.env.API_RATE_LIMIT_TIME_WINDOW_MS ?? 60_000);

for (const [name, value] of [
  ["PORT", port],
  ["API_RATE_LIMIT_MAX", rateLimitMax],
  ["API_RATE_LIMIT_TIME_WINDOW_MS", rateLimitTimeWindowMs],
] as const) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${process.env[name] ?? "(unset)"}`);
  }
}

const unitsSource = await createDatasetHousingUnitsSource(defaultDatasetPath());

const app = await buildApp({
  unitSource: unitsSource,
  logLevel,
  corsOrigins,
  rateLimit: { max: rateLimitMax, timeWindowMs: rateLimitTimeWindowMs },
});

const gracefulShutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));

await app.listen({ port, host });
