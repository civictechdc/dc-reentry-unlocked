import {
  FILTER_CONTROLS,
  FILTER_TARGETS,
  FilterDefinitionSchema,
  FilterSchemaResponseSchema,
  Value,
} from "@dc-reentry/shared";
import type { FilterDefinition } from "@dc-reentry/shared";

/**
 * Schema intake with deliberate strictness (fail closed):
 *
 * - every entry in the published filters array must parse — one invalid
 *   definition, null, or bad option entry means contract drift and THROWS
 *   into the retry path; the only survivor is the documented
 *   unsupported-control exception (tight shape check), so the retry dialogue
 *   can never mask a schema consumed partially (dynamic-filtering
 *   graceful degradation);
 * - definitions with a SUPPORTED control are validated in full (control,
 *   schema-enum target, option shapes);
 * - client-boundary caps (count, size, duplicates) so a buggy API cannot
 *   blow up the interface's DOM or keyed rendering — truncation happens
 *   FIRST, dedupe second (see applyCaps).
 */
const MAX_FILTERS = 64;
const MAX_OPTIONS = 128;
const MAX_LABEL_LENGTH = 200;
const MAX_ID_LENGTH = 100;

/** Malformed (not interpretable) filter-schema payload — the retry path. */
export class MalformedFilterSchemaError extends Error {
  constructor() {
    super("not a filter schema response");
    this.name = "MalformedFilterSchemaError";
  }
}

export function parseFilterSchemaPayload(payload: unknown): FilterDefinition[] {
  if (Value.Check(FilterSchemaResponseSchema, payload)) {
    // Envelope validity is necessary but not sufficient: the caps' invariants
    // (non-empty, bounded id/label/option strings) are enforced STRICTLY on
    // the array too, so a deep drift cannot ride the trusted-schema path.
    assertStrictBounds(payload.filters);
    return applyCaps(payload.filters);
  }
  const candidate = (payload as Partial<{ filters: unknown }> | null)?.filters;
  if (!Array.isArray(candidate)) {
    // Not interpretable at all — contract drift, surfaced as a schema failure.
    throw new MalformedFilterSchemaError();
  }
  // Strict intake: EVERY entry must parse; one bad definition, null, or bad
  // option entry sends the whole load to the retry path.
  const parsed: FilterDefinition[] = candidate.map((item) => parseFilterCandidate(item));
  return applyCaps(parsed);
}

/**
 * Caps applied truncation-FIRST, dedupe SECOND: two ids sharing their first
 * 100 characters would otherwise survive dedupe and then collude as
 * identical rendered keys — the capped collision is deduped away. Options:
 * only the first 128 (post-truncation) options are considered for value
 * dedupe; options beyond that are dropped by the cap anyway (documented
 * cap-first semantics).
 */
function assertStrictBounds(filters: FilterDefinition[]): void {
  // Empty strings are drift (throw); over-cap strings are the CAPS' job
  // (truncate-first in applyCaps) — a cap-long id is a hostiles' size, not a
  // contract violation.
  const nonEmpty = (value: string): boolean => value.length > 0;
  for (const definition of filters) {
    if (!nonEmpty(definition.id) || !nonEmpty(definition.label)) {
      throw new MalformedFilterSchemaError();
    }
    for (const option of definition.options ?? []) {
      if (!nonEmpty(option.value) || !nonEmpty(option.label)) {
        throw new MalformedFilterSchemaError();
      }
    }
  }
}

function applyCaps(filters: FilterDefinition[]): FilterDefinition[] {
  const truncated = filters.slice(0, MAX_FILTERS).map((definition) => ({
    ...definition,
    id: definition.id.slice(0, MAX_ID_LENGTH),
    label: definition.label.slice(0, MAX_LABEL_LENGTH),
    ...(definition.options
      ? {
          options: definition.options.slice(0, MAX_OPTIONS).map((option) => ({
            value: option.value.slice(0, MAX_ID_LENGTH),
            label: option.label.slice(0, MAX_LABEL_LENGTH),
          })),
        }
      : {}),
  }));
  const seenIds = new Set<string>();
  const deduped: FilterDefinition[] = [];
  for (const definition of truncated) {
    // Duplicate (post-truncation) ids are contract drift within one load —
    // only the first definition keeps an id.
    if (seenIds.has(definition.id)) continue;
    seenIds.add(definition.id);
    if (definition.options) {
      const seenValues = new Set<string>();
      definition.options = definition.options.filter((option) => {
        if (seenValues.has(option.value)) return false;
        seenValues.add(option.value);
        return true;
      });
    }
    deduped.push(definition);
  }
  return deduped;
}

/**
 * Fail-closed candidate parsing: any shape violation THROWS (the caller
 * surfaces it as a retryable schema failure). The one documented exception:
 * a definition deviating ONLY by an unsupported control type survives
 * intake — dynamic-filtering graceful degradation — so a partially
 * understood schema never silently switches the whole filter bar off.
 */
function parseFilterCandidate(value: unknown): FilterDefinition {
  if (typeof value !== "object" || value === null) {
    throw new MalformedFilterSchemaError();
  }
  const filter = value as Record<string, unknown>;
  if (typeof filter.id !== "string" || filter.id.length === 0) {
    // an over-cap id is truncated by applyCaps, never silently accepted raw
    throw new MalformedFilterSchemaError();
  }
  if (typeof filter.label !== "string" || filter.label.length === 0) {
    // over-cap labels truncate via applyCaps
    throw new MalformedFilterSchemaError();
  }
  if (typeof filter.control !== "string" || filter.control.length === 0) {
    throw new MalformedFilterSchemaError();
  }
  if (
    (filter.target !== undefined && typeof filter.target !== "string") ||
    !isValidTarget(filter.target)
  ) {
    throw new MalformedFilterSchemaError();
  }
  if (filter.options !== undefined) {
    if (!Array.isArray(filter.options)) throw new MalformedFilterSchemaError();
    for (const option of filter.options) {
      if (typeof option !== "object" || option === null) throw new MalformedFilterSchemaError();
      const { value: optionValue, label } = option as Record<string, unknown>;
      if (typeof optionValue !== "string" || optionValue.length === 0) {
        throw new MalformedFilterSchemaError();
      }
      if (typeof label !== "string" || label.length === 0) throw new MalformedFilterSchemaError();
    }
  }
  if (isKnownControl(filter.control)) {
    // Known controls validate in FULL (schema-enum target included) — a
    // dotted string is not an escape hatch, and a known control with an
    // unrecognized target fails closed.
    const definition = filter as FilterDefinition;
    if (!Value.Check(FilterDefinitionSchema, definition)) throw new MalformedFilterSchemaError();
    return definition;
  }
  return filter as unknown as FilterDefinition;
}

function isKnownControl(control: unknown): boolean {
  return (FILTER_CONTROLS as readonly unknown[]).includes(control);
}

function isValidTarget(target: unknown): boolean {
  return (FILTER_TARGETS as readonly unknown[]).includes(target) || typeof target !== "string";
}
