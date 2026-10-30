import { ErrorEnvelopeSchema } from "@dc-reentry/shared";

/**
 * The shared error envelope, published once as a reusable component so the
 * generated OpenAPI document carries it under a stable name and every error
 * response references it by that name.
 */

export const ERROR_ENVELOPE_SCHEMA_ID = "errorEnvelope";

export const DeclaredErrorEnvelopeSchema = {
  ...JSON.parse(JSON.stringify(ErrorEnvelopeSchema)),
  $id: ERROR_ENVELOPE_SCHEMA_ID,
} as const;

/** Error responses across the document reference the shared envelope. */
export const ERROR_RESPONSE_SCHEMAS = {
  400: { $ref: `${ERROR_ENVELOPE_SCHEMA_ID}#` },
  404: { $ref: `${ERROR_ENVELOPE_SCHEMA_ID}#` },
  429: { $ref: `${ERROR_ENVELOPE_SCHEMA_ID}#` },
  500: { $ref: `${ERROR_ENVELOPE_SCHEMA_ID}#` },
} as const;
