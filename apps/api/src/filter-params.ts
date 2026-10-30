import Type, { type Static, type TSchema } from "typebox";
import { UNIT_FILTERS, WardSchema, type FilterDefinition } from "@dc-reentry/shared";

/**
 * Request-side filter plumbing, derived from the shared filter schema: the
 * pinned filter definitions are the single source of truth for parameter
 * names, targets, and option values. Nothing about an individual filter is
 * hardcoded here — a schema-driven filter appears as a query parameter with
 * no change to this module.
 */

/** Boolean filter selections travel as yes/no (never as true/false/0/1). */
const BOOLEAN_FILTER_VALUES = ["yes", "no"] as const;

/** Filter query parameters are selective lists: one value or repeated values. */
const multiValue = (item: TSchema): TSchema => Type.Array(item);

function itemSchemaFor(definition: FilterDefinition): TSchema {
  switch (definition.control) {
    case "boolean":
      return Type.Unsafe({ type: "string", enum: [...BOOLEAN_FILTER_VALUES] });
    case "single-select":
    case "multi-select":
      if (definition.target === "unit.ward") {
        // The ward item schema IS the shared ward contract — never restated.
        return WardSchema;
      }
      return Type.Unsafe({
        type: "string",
        enum: (definition.options ?? []).map((option) => option.value),
      });
  }
}

/**
 * The json schema for the units listing querystring, derived from the
 * filter definitions. Additional properties are rejected: every
 * unrecognized filter name is an invalid-filter error, not a silently
 * ignored suggestion.
 */
export const FILTER_QUERY_SCHEMA = Type.Object(
  Object.fromEntries(
    UNIT_FILTERS.map((definition) => [
      definition.id,
      Type.Optional(multiValue(itemSchemaFor(definition))),
    ]),
  ),
  { additionalProperties: false },
);
export type FilterQuery = Static<typeof FILTER_QUERY_SCHEMA>;

export const FILTER_PARAM_NAMES: readonly string[] = UNIT_FILTERS.map(
  (definition) => definition.id,
);

/**
 * A validated query → the selection shape the data source reads. Query
 * values arrive coerced by the validator: each filter selection is an
 * array (a single value behaves as a one-item list), ward items arrive as
 * integers and are read back as their URL-shaped decimal strings.
 */
export function parseFilterSelection(query: FilterQuery): Record<string, string[]> {
  const selection: Record<string, string[]> = {};
  for (const key of Object.keys(query)) {
    const raw = query[key];
    if (!Array.isArray(raw)) continue;
    const values = raw.filter(
      (v): v is string | number => typeof v === "string" || typeof v === "number",
    );
    const unique = [...new Set(values.map(String))];
    if (unique.length > 0) selection[key] = unique;
  }
  return selection;
}
