import { SCHEMA_VERSION, type ErrorEnvelope, type ErrorCode } from "@dc-reentry/shared";
import type { FastifyError, FastifyRequest } from "fastify";

/**
 * The stable error envelope and its mapping. Every failure reaches a client
 * with the same shape; messages are safe public text — never exception
 * passthrough. Real failure detail goes to server logs only.
 */

const SAFE_PUBLIC_MESSAGES: Record<ErrorCode, string> = {
  "not-found": "There is no such route on this API.",
  // `service-unavailable` is reserved vocabulary: nothing in this server
  // currently emits it (inventory access is in-memory and gated at boot).
  // The frontend consumes it for its API-down state when it cannot reach
  // the service at all; keeping the code envelope-valid costs old clients
  // nothing and lets any future degraded mode adopt it without a contract
  // revision.
  "service-unavailable": "The housing inventory is temporarily unavailable. Please retry later.",
  "invalid-filter":
    "At least one filter name or value is not defined by the published filter schema — see GET /filters.",
  "invalid-request": "The request is malformed.",
  "internal-error": "Something went wrong serving this request. Please retry later.",
  "rate-limited": "Too many requests — please wait a moment before trying again.",
};

export interface MappedError {
  statusCode: number;
  code: ErrorCode;
}

/**
 * Maps a thrown error to (status code, machine code). Validation failures
 * on this API are filter failures (the only validated request parts are
 * filter query parameters), so a validation error is always
 * invalid-filter. Everything else with a 400-level status is an invalid
 * request; 5xx stays internal-error.
 */
export function mapErrorToCode(error: unknown): MappedError {
  const err = error as FastifyError;
  const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
  if (statusCode === 429) return { statusCode, code: "rate-limited" };
  if (statusCode === 404) return { statusCode, code: "not-found" };
  if (statusCode < 400 || statusCode >= 500) return { statusCode: 500, code: "internal-error" };
  if (err?.validation) return { statusCode: 400, code: "invalid-filter" };
  if (err?.code === "FST_ERR_VALIDATION") return { statusCode: 400, code: "invalid-filter" };
  return { statusCode: 400, code: "invalid-request" };
}

export function errorEnvelope(code: ErrorCode, request: FastifyRequest): ErrorEnvelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    code,
    message: SAFE_PUBLIC_MESSAGES[code],
    correlationId: String(request.id),
  };
}
