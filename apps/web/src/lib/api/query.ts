import type { FilterDefinition } from "@dc-reentry/shared";
import type { FilterSelection } from "./selection";

/**
 * Query-string building for `GET /units` (docs/api.md): each filter
 * selection travels as repeated parameters (`?ward=1&ward=3`); boolean
 * selections travel as `yes`/`no`; single-select sends at most one value.
 *
 * The selection comes straight from the schema-rendered UI, so unknown
 * definitions never reach here — but building defensively keeps a stray
 * key from becoming an `invalid-filter` 400 the user cannot recover from
 * (unsupported control renderings have no query representation, so their
 * selection is deliberately dropped instead of sent).
 */
export const BOOLEAN_VALUES = ["yes", "no"] as const;

export function buildUnitsQueryPath(
  selection: FilterSelection,
  schema: readonly FilterDefinition[],
): string {
  const params = new URLSearchParams();
  for (const definition of schema) {
    if (definition.control === "boolean") {
      appendBoolean(params, definition.id, selection[definition.id]);
      continue;
    }
    if (definition.control === "single-select" || definition.control === "multi-select") {
      for (const value of selection[definition.id] ?? []) {
        params.append(definition.id, value);
      }
    }
    // Any other control type has no query representation — dropped.
  }
  const query = params.toString();
  return query.length > 0 ? `/units?${query}` : "/units";
}

function appendBoolean(params: URLSearchParams, id: string, selected?: readonly string[]): void {
  const chosen = (selected ?? []).find((value) =>
    (BOOLEAN_VALUES as readonly string[]).includes(value),
  );
  if (chosen) params.append(id, chosen);
}
