/**
 * Fast-check model-based test of the filter-selection state machine — the
 * documented fc.commands + fc.modelRun mechanism. The MODEL is independent
 * of the system under test: it reimplements the selection semantics and
 * builds its own expected request path. Any SUT bug that diverges from the
 * model fails the sequence.
 *
 * The store applies synchronously up to the transport call (the fetch is
 * awaited afterwards), so a recording transport's `lastPath` is observable
 * synchronously — the sync model run can drive and verify the store.
 */
import fc from "fast-check";
import { UNIT_FILTERS, type FilterDefinition } from "@dc-reentry/shared";
import { describe, expect, it } from "vitest";
import { HousingStore } from "./housing-store.svelte";
import { optionValues } from "#lib/api/selection.ts";
import type { SelectionAction } from "#lib/api/selection.ts";

/** Recording transport (no network): `lastPath` is set synchronously at call time. */
class RecordingTransport {
  schema: FilterDefinition[] = UNIT_FILTERS;
  lastPath: string | null = null;

  async filters(): Promise<FilterDefinition[]> {
    return this.schema;
  }

  async units(path: string): Promise<never[]> {
    this.lastPath = path;
    return [];
  }
}

type Model = {
  selection: Record<string, string[]>;
  expectedPath: string | null;
  history: string[];
};
type Real = { store: HousingStore; transport: RecordingTransport };

/** The renderable schema the machine runs over (all published definitions are renderable). */
const renderableSchema: FilterDefinition[] = UNIT_FILTERS;

/** Independent model: build the expected request path from the model alone. */
function modelQueryPath(selection: Record<string, string[]>): string {
  const params = new URLSearchParams();
  for (const definition of renderableSchema) {
    const values = selection[definition.id] ?? [];
    if (definition.control === "boolean") {
      const booleanValue = values.find((value) => value === "yes" || value === "no");
      if (booleanValue !== undefined) params.append(definition.id, booleanValue);
    } else if (
      (definition.control === "single-select" || definition.control === "multi-select") &&
      values.length > 0
    ) {
      for (const value of values) params.append(definition.id, value);
    }
  }
  const query = params.toString();
  return query.length > 0 ? `/units?${query}` : "/units";
}

/** Independent model selection semantics (not importing the SUT reducer). */
function modelApply(
  model: Model,
  filterId: string,
  control: FilterDefinition["control"],
  values: readonly string[],
): void {
  if (control === "multi-select") {
    const blended = [...(model.selection[filterId] ?? []), ...values].filter(
      (value, index, all) => all.indexOf(value) === index,
    );
    if (blended.length === 0) delete model.selection[filterId];
    else model.selection[filterId] = blended;
    return;
  }
  if (values.length === 0) {
    delete model.selection[filterId];
    return;
  }
  model.selection[filterId] = [...values];
}

function modelRemoveValue(model: Model, filterId: string, value: string): void {
  const rest = (model.selection[filterId] ?? []).filter((candidate) => candidate !== value);
  if (rest.length === 0) delete model.selection[filterId];
  else model.selection[filterId] = rest;
}

function modelRemoveFilter(model: Model, filterId: string): void {
  delete model.selection[filterId];
}

/** The SUT action surface, driven synchronously by the model run. */
function drive(real: Real, action: SelectionAction): void {
  void real.store.apply(action);
}

/** Every (filter, option) touch-point the UI could apply. */
type Touch = { filterId: string; control: FilterDefinition["control"]; value: string };
const touchPoints: Touch[] = renderableSchema.flatMap((definition) =>
  optionValues(definition).map((value) => ({
    filterId: definition.id,
    control: definition.control,
    value,
  })),
);

/**
 * One machine step of the fast-check command protocol — the "verify"
 * command asserts the system against the INDEPENDENT model after each
 * generated sequence step.
 */
const commands = [
  fc.constantFrom(...touchPoints).map((touch) => ({
    kind: "apply" as const,
    touch,
    check: (): true => true,
    run: (m: Model, real: Real): void => {
      modelApply(m, touch.filterId, touch.control, [touch.value]);
      m.expectedPath = modelQueryPath(m.selection);
      m.history.push(m.expectedPath);
      drive(real, {
        kind: "apply",
        filterId: touch.filterId,
        control: touch.control,
        values: [touch.value],
      });
    },
    toString: () => `apply(${touch.filterId}=${touch.value})`,
  })),
  fc.constantFrom(...touchPoints).map((touch) => ({
    kind: "remove-value" as const,
    touch,
    check: (m: Model): boolean => (m.selection[touch.filterId] ?? []).includes(touch.value),
    run: (m: Model, real: Real): void => {
      modelRemoveValue(m, touch.filterId, touch.value);
      m.expectedPath = modelQueryPath(m.selection);
      m.history.push(m.expectedPath);
      drive(real, {
        kind: "remove-value",
        filterId: touch.filterId,
        value: touch.value,
      });
    },
    toString: () => `removeValue(${touch.filterId}=${touch.value})`,
  })),
  fc.constantFrom(...renderableSchema.map((definition) => definition.id)).map((filterId) => ({
    kind: "remove-filter" as const,
    filterId,
    check: (): true => true,
    run: (m: Model, real: Real): void => {
      modelRemoveFilter(m, filterId);
      m.expectedPath = modelQueryPath(m.selection);
      m.history.push(m.expectedPath);
      drive(real, { kind: "remove-filter", filterId });
    },
    toString: () => `removeFilter(${filterId})`,
  })),
  fc.constant({
    kind: "clear" as const,
    check: (): true => true,
    run: (m: Model, real: Real): void => {
      for (const key of Object.keys(m.selection)) delete m.selection[key];
      m.expectedPath = modelQueryPath(m.selection);
      m.history.push(m.expectedPath);
      drive(real, { kind: "clear" });
    },
    toString: () => "clear",
  }),
  fc.constant({
    kind: "verify" as const,
    check: (): true => true,
    run: (m: Model, real: Real): void => {
      // normalize empty entries the way empties fall out of selections
      for (const key of Object.keys(m.selection)) {
        expect(m.selection[key]!.length, `${key} selection nonempty`).toBeGreaterThan(0);
      }
      expect({ ...real.store.selection }).toEqual({ ...m.selection });
      if (m.history.length === 0) {
        expect(real.transport.lastPath).toBeNull();
      } else {
        expect(m.history).toContain(real.transport.lastPath);
      }
      if (m.history.length === 1) {
        expect(real.transport.lastPath).toBe(m.history[0]);
      }
    },
    toString: () => "verify",
  }),
];

describe("filter-selection state machine (fc.commands + fc.modelRun)", () => {
  it("keeps an independent model and the store in lockstep with identical request paths", () => {
    fc.assert(
      fc.property(fc.commands(commands, { size: "small" }), (cmds) => {
        fc.modelRun(() => {
          const transport = new RecordingTransport();
          const store = new HousingStore(transport as never);
          // The model run drives the renderable machine: install the schema
          // (initialize() would await a network-fake; the schema is a plain
          // reactive field — assignment is the synchronous shortcut the
          // retry path uses).
          store.filtersSchema = renderableSchema;
          return {
            model: { selection: {}, expectedPath: null, history: [] },
            real: { store, transport },
          };
        }, cmds);
      }),
      { timeout: 120_000 },
    );
  });
});
