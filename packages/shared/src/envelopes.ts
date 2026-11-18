import Type, { type Static } from "typebox";
import { SCHEMA_VERSION, SchemaVersionSchema } from "./primitives";
import { FilterDefinitionSchema } from "./filters";
import { ProgramSchema } from "./program";
import { UnitCardSchema } from "./unit";

/**
 * API response envelopes: typed response contracts and the stable error
 * envelope (machine code + human message + correlation id). Internal
 * diagnostic detail is logged server-side, never exposed in the envelope.
 */

/**
 * The one-sentence synthetic-data disclaimer, verbatim from the dataset —
 * the single source every producer and renderer must serve byte-exact.
 */
export const SYNTHETIC_DISCLOSURE =
  "Synthetic prototype data — fictional providers, generated addresses on real DC geography. Not real housing inventory; never contact these organizations.";

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

/**
 * CONSUMER-INTAKE VARIANTS for the `/units` fetch — tolerant read-side
 * schemas, built from the canonical schemas' shapes. Each enumerated
 * program taxonomy field (housingType, lengthOfStay, population, gender)
 * widens from `taxonomy | "unknown"` to a non-empty string, so a payload
 * carrying a taxonomy value NEWER than a consumer's compiled vocabulary
 * still passes intake and renders a presentation derived from the published
 * value. Everything else — the tri-state PolicyState fields, roomType,
 * ward, quadrant, availabilityState, verificationBadge — stays strict, and
 * any field the canonical schemas gain flows into intake automatically.
 *
 * These variants are never the served contract: the canonical schemas
 * (`ProgramSchema`, `UnitCardSchema`, `UnitsResponseSchema`) remain the
 * producer/API/OpenAPI/docgen truth, and producer-side validation does not
 * loosen. They also are not documented in the generated model reference,
 * which describes what is served.
 *
 * The two unknowns must never conflate (product decision 2026-11-06): a
 * newer published value is truthful data the consumer derives a rendering
 * from; `"unknown"` means the source did not state the value and stays the
 * honest "Unknown".
 */

/** Consumer-intake program: the canonical program with the taxonomy fields widened to non-empty strings. */
const ProgramIntakeSchema = Type.Evaluate(
  Type.Intersect([
    Type.Omit(ProgramSchema, ["housingType", "lengthOfStay", "population", "gender"]),
    Type.Object({
      housingType: Type.String({
        minLength: 1,
        description:
          'Housing type taxonomy value as published (consumer-intake: any non-empty string; "unknown" stays the honest unknown).',
      }),
      lengthOfStay: Type.String({
        minLength: 1,
        description:
          'Length-of-stay taxonomy value as published (consumer-intake: any non-empty string; "unknown" stays the honest unknown).',
      }),
      population: Type.String({
        minLength: 1,
        description:
          'Population taxonomy value as published (consumer-intake: any non-empty string; "unknown" stays the honest unknown).',
      }),
      gender: Type.String({
        minLength: 1,
        description:
          'Gender taxonomy value as published (consumer-intake: any non-empty string; "unknown" stays the honest unknown).',
      }),
    }),
  ]),
  {
    description:
      "Consumer-intake variant of the housing program: identical to the canonical program " +
      "except the enumerated eligibility fields widen to a non-empty string, so taxonomy " +
      "values newer than a consumer's vocabulary pass intake. The canonical program schema " +
      "stays the producer truth.",
  },
);

/** Consumer-intake unit card: the canonical card carrying the intake program. */
const UnitCardIntakeSchema = Type.Evaluate(
  Type.Intersect([
    Type.Omit(UnitCardSchema, ["program"]),
    Type.Object({ program: ProgramIntakeSchema }),
  ]),
  {
    description:
      "Consumer-intake variant of the flattened unit card: identical to the canonical card " +
      "except its program carries the tolerant taxonomy fields. The canonical card schema " +
      "stays the producer truth.",
  },
);
export type UnitCardIntake = Static<typeof UnitCardIntakeSchema>;

/**
 * Tolerant `/units` intake for the web client: the canonical envelope shape
 * (schemaVersion, the `synthetic: true` marker, the non-empty disclosure,
 * the units array) with each card's program taxonomy fields widened. The
 * canonical units envelope stays the API contract.
 */
export const UnitsResponseIntakeSchema = Type.Evaluate(
  Type.Intersect([
    Type.Omit(UnitsResponseSchema, ["units"]),
    Type.Object({
      units: Type.Array(UnitCardIntakeSchema, {
        description: "The available unit cards (only available units reach this envelope).",
      }),
    }),
  ]),
  {
    description:
      "Tolerant consumer intake for the successful units listing: the canonical envelope " +
      "shape with each unit card's program taxonomy fields widened to a non-empty string, " +
      "so taxonomy values newer than the consumer's vocabulary pass intake. The canonical " +
      "units envelope stays the served contract.",
  },
);
export type UnitsResponseIntake = Static<typeof UnitsResponseIntakeSchema>;

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
        schemaVersion: SCHEMA_VERSION,
        code: "not-found",
        message: "Unit not found.",
        correlationId: "req-7f3a9c",
      },
    ],
  },
);
export type ErrorEnvelope = Static<typeof ErrorEnvelopeSchema>;
