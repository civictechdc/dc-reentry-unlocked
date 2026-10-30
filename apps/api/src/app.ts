import { randomUUID } from "node:crypto";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
// Response compression (user decision 2026-10-29): the units payload measured
// ~984KB per 1,000 unit cards uncompressed — brotli/gzip on the wire keeps the
// ~500KB/1,000 budget reachable without payload trimming.
import compress from "@fastify/compress";
// ajv-formats is not imported by this source tree: it is declared in
// package.json only to satisfy @fastify/type-provider-typebox's peer
// dependency (the type provider resolves it lazily for its format helper).
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { SCHEMA_VERSION } from "@dc-reentry/shared";
import type { HousingUnitsSource } from "./datasource";
import { mapErrorToCode, errorEnvelope } from "./errors";
import { DeclaredErrorEnvelopeSchema } from "./error-schemas";
import { healthRoutes } from "./routes/health";
import { unitsRoutes } from "./routes/units";
import { filtersRoutes } from "./routes/filters";
import { openApiRoutes } from "./routes/openapi";

export type RawServerDefaults = import("fastify").RawServerDefault;

declare module "fastify" {
  interface FastifyInstance {
    /** The data source seam: the only way routes reach housing data. */
    units: HousingUnitsSource;
  }
}

export type HousingApi = FastifyInstance<
  import("fastify").RawServerDefault,
  import("fastify").RawRequestDefaultExpression,
  import("fastify").RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>;

export interface HousingApiOptions {
  /** The data source the routes serve from (see datasource.ts for the seam). */
  unitSource: HousingUnitsSource;
  /** Log level for the built-in pino logger (ignored when loggerInstance is given). */
  logLevel?: string;
  /** Fixture logger for tests; production boots with the built-in logger. */
  loggerInstance?: FastifyBaseLogger;
  /** Allowed CORS origins; never widened to "*" — this is a public read-only API. */
  corsOrigins?: readonly string[];
  /** Default rate limiting per client IP (sane defaults: 100 requests per minute). */
  rateLimit?: { max?: number; timeWindowMs?: number };
}

/** Default CORS allowance: the frontend dev server that will consume the API. */
const DEFAULT_CORS_ORIGINS = ["http://localhost:5173"] as const;
/** Default per-client-IP request budget, enforced as a decisive default. */
const DEFAULT_RATE_LIMIT = { max: 100, timeWindowMs: 60_000 } as const;

export async function buildApp(options: HousingApiOptions): Promise<HousingApi> {
  const app = Fastify({
    // Fixture loggers arrive pre-built (tests capture pino output); normal
    // boots configure the built-in pino logger by level.
    ...(options.loggerInstance
      ? { loggerInstance: options.loggerInstance }
      : { logger: { level: options.logLevel ?? "info" } }),
    // Request ids are generated here, always a uuid — a client-supplied
    // header can never state someone else's correlation id through this API.
    genReqId: () => randomUUID(),
    // `removeAdditional: false` is load-bearing: Fastify's Ajv default
    // (removeAdditional: true) would silently STRIP any unrecognized query
    // parameter instead of rejecting it, so an invalid filter name would be
    // ignored and the listing served unfiltered. With false, the
    // additionalProperties check fails and the request is answered 400.
    ajv: { customOptions: { removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.decorate("units", options.unitSource);
  app.addSchema(DeclaredErrorEnvelopeSchema);

  // The error-handling hooks are wired BEFORE any plugin that registers
  // routes: Fastify routes capture the error handler present in their
  // encapsulation scope at registration time, so the shared envelope must
  // exist before the CORS plugin creates its wildcard OPTIONS route.
  app.addHook("onSend", async function echoRequestIdentifier(request, reply) {
    reply.header("x-request-id", String(request.id));
  });

  app.setErrorHandler(function handleRequestFailure(error, request, reply) {
    const mapped = mapErrorToCode(error);
    if (mapped.statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    } else {
      request.log.info({ err: error }, "request rejected");
    }
    reply.code(mapped.statusCode).send(errorEnvelope(mapped.code, request));
  });

  app.setNotFoundHandler(function serveUnknownRoute(request, reply) {
    reply.code(404).send(errorEnvelope("not-found", request));
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Housing availability API (synthetic prototype data)",
        description:
          "Synthetic prototype inventory: fictional providers on real DC geography. Never contact these organizations. Serves only currently-available housing units.",
        version: SCHEMA_VERSION,
      },
      tags: [{ name: "inventory" }],
    },
    // OpenAPI 3.1 is a faithful projection of the TypeBox schemas: const and
    // the null union members need no OpenAPI-3.0 rewrites.
    convertConstToEnum: false,
    // Components keep their declared $ids (the error envelope stays
    // "errorEnvelope" instead of a meaningless def-0) so consumers can
    // reference stable schema names.
    refResolver: {
      buildLocalReference(json, _baseUri, _fragment, index) {
        return (json as { $id?: string; title?: string }).$id ?? `def-${index}`;
      },
    },
  });

  // Helmet is registered FIRST so its onRequest hook runs before anything
  // that can terminate a reply: the security headers are on every response,
  // including rate-limit rejections and CORS-terminated preflights.
  await app.register(helmet);
  // @fastify/rate-limit hooks routes INDIVIDUALLY (its onRoute hooking does
  // not reach the not-found handler or CORS-terminated preflight replies),
  // so global mode is disabled and the plugin's own documented
  // `fastify.rateLimit()` decorator is attached once as a root-level
  // onRequest hook. This one evaluation covers every request — routes,
  // unknown routes, and preflights — with a single per-client budget and
  // no double counting.
  await app.register(rateLimit, {
    global: false,
    max: options.rateLimit?.max ?? DEFAULT_RATE_LIMIT.max,
    timeWindow: options.rateLimit?.timeWindowMs ?? DEFAULT_RATE_LIMIT.timeWindowMs,
  });
  app.addHook("onRequest", app.rateLimit());
  await app.register(cors, {
    origin: [...(options.corsOrigins ?? DEFAULT_CORS_ORIGINS)],
    // Fail closed on malformed preflights: a request claiming preflight
    // without the required headers is refused (400) instead of being
    // answered permissively. Verified against the plugin source: this
    // reply leaves the app's hook chain inside the CORS plugin — helmet
    // headers and the rate-limit count reach it (this hook runs first),
    // but the JSON error envelope does not. Documented as the residual in
    // docs/api.md.
    strictPreflight: true,
  });

  // Compression AFTER helmet (its onSend hook runs in registration order) and
  // BEFORE routes: responses made by the compress plugin carry content-encoding
  // itself; CORS-terminated preflights have no body and stay untouched.
  // `global: true` documents the intent — every route compresses by
  // accept-encoding preference (no double-compression: the plugin skips
  // replies that already carry a content-encoding). `globalDecompression:
  // false` disables the plugin's request-decompression hook per its
  // documented option — this API is read-only GET, so request bodies are
  // never consumed (verified against the installed plugin README).
  await app.register(compress, { global: true, globalDecompression: false });

  await app.register(healthRoutes);
  await app.register(unitsRoutes);
  await app.register(filtersRoutes);
  await app.register(openApiRoutes);

  await app.ready();
  return app;
}
