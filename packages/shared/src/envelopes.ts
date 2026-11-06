import Type, { type Static } from "typebox";
import { SCHEMA_VERSION, SchemaVersionSchema } from "./primitives";
import { FilterDefinitionSchema } from "./filters";
import { UnitCardSchema } from "./unit";

/**
 * API response envelopes: typed response contracts and the stable error
 * envelope (machine code + human message + correlation id). Internal
 * diagnostic detail is logged server-side, never exposed in the envelope.
 */

/**
 * Successful units listing (only available units reach this envelope).
 * Both synthetic markers are REQUIRED on every payload: the API surface is
 * read-only and its data must never be mistakable for
 * real housing inventory, wherever the payload travels after extraction.
 */
export const UnitsResponseSchema = Type.Object(
  {
    schemaVersion: SchemaVersionSchema,
    /** Hard marker: this payload describes fictional data only. */
    synthetic: Type.Literal(true, {
      description: "Hard marker: this payload describes fictional data only.",
    }),
    /** The one-sentence synthetic-data disclaimer, verbatim from the dataset. */
    disclosure: Type.String({
      minLength: 1,
      description: "The one-sentence synthetic-data disclaimer, verbatim from the dataset.",
    }),
    units: Type.Array(UnitCardSchema, {
      description: "The available unit cards (only available units reach this envelope).",
    }),
  },
  {
    description:
      "Successful units listing (only available units reach this envelope). Both synthetic " +
      "markers are required on every payload: the API surface is read-only and its data " +
      "must never be mistakable for real housing inventory.",
  },
);
export type UnitsResponse = Static<typeof UnitsResponseSchema>;

/** Successful filter-schema response. */
export const FilterSchemaResponseSchema = Type.Object(
  {
    schemaVersion: SchemaVersionSchema,
    filters: Type.Array(FilterDefinitionSchema, {
      description:
        "The published filter definitions — the single source of truth for what filters exist.",
    }),
  },
  { description: "Successful filter-schema response: the published list of filter definitions." },
);
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
  "rate-limited",
] as const;

export const ErrorCodeSchema = Type.Enum([...ERROR_CODES], {
  description:
    "Stable machine-readable error codes — status codes may evolve, these identifiers are " +
    "the consumer-stable vocabulary. Additive-only: new codes must never break an existing " +
    "consumer's switch, so unknown codes degrade to a generic failure rendering.",
  "x-enum-meanings": {
    "not-found": "Unknown route (there is no per-unit detail view on this listing API yet).",
    "service-unavailable": "The API cannot serve the data right now — safe to retry later.",
    "invalid-filter": "A filter name or value the published filter schema does not define.",
    "invalid-request": "A malformed request that is not a filter problem.",
    "internal-error": "Something failed server-side; detail stays in server logs.",
    "rate-limited": "Too many requests — slow down, and honor the Retry-After response header.",
  },
});
export type ErrorCode = Static<typeof ErrorCodeSchema>;

export const ErrorEnvelopeSchema = Type.Object(
  {
    schemaVersion: Type.Literal(SCHEMA_VERSION, {
      description: "The shared-contract schema version this payload speaks.",
    }),
    code: ErrorCodeSchema,
    message: Type.String({ description: "Human-readable error message." }),
    /** Correlation id echoed into structured request logs, so bug reports stay traceable. */
    correlationId: Type.Optional(
      Type.String({
        description:
          "Correlation id echoed into structured request logs, so bug reports stay traceable.",
      }),
    ),
  },
  {
    description:
      "Stable error envelope: machine code + human message + correlation id. Internal " +
      "diagnostic detail is logged server-side, never exposed in the envelope.",
    examples: [
      {
        schemaVersion: "2.0",
        code: "not-found",
        message: "Unit not found.",
        correlationId: "req-7f3a9c",
      },
    ],
  },
);
export type ErrorEnvelope = Static<typeof ErrorEnvelopeSchema>;
