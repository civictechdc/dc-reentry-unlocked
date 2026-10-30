import {
  ErrorEnvelopeSchema,
  UnitsResponseSchema,
  Value,
  type ErrorCode,
  type FilterDefinition,
  type UnitCard,
} from "@dc-reentry/shared";
import { parseFilterSchemaPayload } from "#lib/api/filters-response.ts";

/** Base URL of the housing-inventory API (configurable for compose); the dev default matches the published CORS allow list. */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** Per-request deadline: hanging endpoints must not block the refresh cycle forever; aborts surface as ClientError (the retry affordance). */
export const FETCH_TIMEOUT_MS = 30_000;

/** A typed failure surfaced from the API's stable error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly correlationId: string | undefined;

  constructor(status: number, code: ErrorCode, message: string, correlationId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

/** Anything the client couldn't make sense of (network failure, non-JSON, validation mismatch, timeout). */
export class ClientError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = "ClientError";
  }
}

async function parseFailure(response: Response): Promise<ApiError> {
  let envelope: unknown;
  try {
    envelope = await response.clone().json();
  } catch {
    /* fall through with the status code only */
  }
  if (Value.Check(ErrorEnvelopeSchema, envelope)) {
    return new ApiError(response.status, envelope.code, envelope.message, envelope.correlationId);
  }
  return new ApiError(response.status, "internal-error", response.statusText);
}

/**
 * JSON fetch against the API base with envelope validation and a deadline
 * (`FETCH_TIMEOUT_MS` — 30s, aborts a hanging endpoint). Network-level
 * failures (unreachable backend, timeout) surface as ClientError; the
 * callers decide how a stale screen degrades.
 */
async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const timeout = new AbortController();
  const deadline = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(new URL(path, `${API_BASE_URL}/`), {
        ...init,
        // the DEADLINE lands after `...init` so a caller-supplied init can
        // never replace the timeout signal (last-write wins)
        headers: { accept: "application/json", ...init?.headers },
        signal: timeout.signal,
      });
    } catch (cause) {
      throw new ClientError(`unreachable: ${API_BASE_URL}`, { cause });
    }
    if (!response.ok) throw await parseFailure(response);
    try {
      return await response.json();
    } catch (cause) {
      throw new ClientError("not a JSON response", { cause });
    }
  } finally {
    clearTimeout(deadline);
  }
}

export interface HousingTransport {
  filters(): Promise<FilterDefinition[]>;
  units(path: string): Promise<UnitCard[]>;
}

/**
 * Real transport binding endpoints from docs/api.md:
 * - `GET /filters` — the published filter schema (drives the whole filter UI).
 * - `GET /units?…` — currently-available unit cards, filtered through the
 *   published schema (repeated parameters mean "any of" within one filter;
 *   different filters narrow conjunctively).
 */
export const housingApi: HousingTransport = {
  filters: async () => {
    const payload = await requestJson("/filters");
    return parseFilterSchemaPayload(payload);
  },
  units: async (path) => {
    const payload = await requestJson(path);
    if (!Value.Check(UnitsResponseSchema, payload)) {
      throw new ClientError("unexpected /units envelope");
    }
    return payload.units;
  },
};
