import type { FilterDefinition } from "@dc-reentry/shared";

/**
 * One selection per filter id, keyed by the published filter schema:
 * `ward=1,3`, `housing-type=transitional`, `referral-required=yes`.
 * Values are schema option values (or `yes`/`no` for boolean controls).
 *
 * The selection objects are null-prototype records: a hostile (or buggy)
 * API can publish ids like `constructor` or `__proto__` and they must
 * behave as ordinary keys, never as object-prototype facilities.
 */
export type FilterSelection = Readonly<Record<string, readonly string[]>>;

/** Fresh null-prototype selection accumulator. */
export function newSelection(): Record<string, string[]> {
  return Object.create(null);
}

/**
 * Generic selection semantics shared by the schema-rendered controls:
 * - boolean/single-select hold at most one value,
 * - multi-select accumulates values,
 * - selections for schema ids that are gone after a schema fetch are
 *   dropped in `reconcileSelection` (which the store runs through its
 *   renderable-filter view) — nothing here consults the schema.
 */
export type SelectionAction =
  | {
      kind: "apply";
      filterId: string;
      control: FilterDefinition["control"];
      values: readonly string[];
    }
  | { kind: "remove-value"; filterId: string; value: string }
  | { kind: "remove-filter"; filterId: string }
  | { kind: "clear" };

export function reduceSelection(
  current: FilterSelection,
  action: SelectionAction,
): Record<string, string[]> {
  const next = newSelection();
  for (const [id, values] of Object.entries(current)) {
    next[id] = [...values];
  }
  switch (action.kind) {
    case "apply": {
      const values =
        action.control === "multi-select"
          ? [...(next[action.filterId] ?? []), ...action.values].filter(
              (value, index, all) => all.indexOf(value) === index,
            )
          : [...action.values];
      next[action.filterId] = values;
      break;
    }
    case "remove-value": {
      next[action.filterId] = (next[action.filterId] ?? []).filter(
        (value) => value !== action.value,
      );
      break;
    }
    case "remove-filter": {
      delete next[action.filterId];
      break;
    }
    case "clear":
      return newSelection();
  }
  return pruned(next);
}

/**
 * Empty value lists fall out of the selection (an empty list is
 * indistinguishable from no selection — both send nothing).
 */
function pruned(selection: Record<string, readonly string[]>): Record<string, string[]> {
  const next = newSelection();
  for (const [id, values] of Object.entries(selection)) {
    const kept = values.filter((value) => value.length > 0);
    if (kept.length > 0) next[id] = [...kept];
  }
  return next;
}

/**
 * Discard every selection that no longer points at one of the given
 * (renderable) filter definitions — removed schema filters, and selections
 * for unsupported control types. Null-prototype in, null-prototype out.
 */
export function reconcileSelection(
  current: FilterSelection,
  schema: readonly FilterDefinition[],
): Record<string, string[]> {
  const supported = new Set(schema.map((definition) => definition.id));
  const next = newSelection();
  for (const [id, values] of Object.entries(current)) {
    if (supported.has(id) && values.length > 0) next[id] = [...values];
  }
  return next;
}

/** The values a filter renders for (union of schema options; booleans render yes/no). */
export function optionValues(definition: FilterDefinition): string[] {
  if (definition.control === "boolean") return ["yes", "no"];
  return (definition.options ?? []).map((option) => option.value);
}
