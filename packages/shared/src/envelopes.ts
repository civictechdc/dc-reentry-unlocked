import Type, { type Static } from "typebox";
import { SCHEMA_VERSION, SchemaVersionSchema } from "./primitives";
import { FilterDefinitionSchema } from "./filters";
import { UnitCardSchema } from "./unit";

/**
 * API response envelopes: typed response contracts and the stable error
 * envelope (machine code + human message + correlation id). Internal
 * diagnostic detail is logged server-side, never exposed in the envelope.
 */

/** Successful units listing (only available units reach this envelope). */
export const UnitsResponseSchema = Type.Object({
  schemaVersion: SchemaVersionSchema,
  units: Type.Array(UnitCardSchema),
});
export type UnitsResponse = Static<typeof UnitsResponseSchema>;

/** Successful filter-schema response. */
export const FilterSchemaResponseSchema = Type.Object({
  schemaVersion: SchemaVersionSchema,
  filters: Type.Array(FilterDefinitionSchema),
});
export type FilterSchemaResponse = Static<typeof FilterSchemaResponseSchema>;

/**
 * Stable machine-readable error codes — status codes may evolve, these
 * identifiers are the consumer-stable vocabulary (spec: "Error responses").
 */
export const ERROR_CODES = [
  "not-found",
  "service-unavailable",
  "invalid-filter",
  "invalid-request",
  "internal-error",
] as const;

export const ErrorCodeSchema = Type.Enum([...ERROR_CODES]);
export type ErrorCode = Static<typeof ErrorCodeSchema>;

export const ErrorEnvelopeSchema = Type.Object({
  schemaVersion: Type.Literal(SCHEMA_VERSION),
  code: ErrorCodeSchema,
  message: Type.String(),
  /** Correlation id echoed into structured request logs, so bug reports stay traceable. */
  correlationId: Type.Optional(Type.String()),
});
export type ErrorEnvelope = Static<typeof ErrorEnvelopeSchema>;
