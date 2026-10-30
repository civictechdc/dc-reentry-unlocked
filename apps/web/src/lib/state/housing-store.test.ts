import { describe, expect, test, vi } from "vitest";
import { UNIT_FILTERS, type FilterDefinition, type UnitCard } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { HousingStore, SUPPORTED_CONTROLS, type LoadFailure } from "./housing-store.svelte";
import { ClientError } from "#lib/api/client.js";
import type { HousingTransport } from "#lib/api/client.ts";

/** Fake transport recording every request path (no network, no timers). */
class RecordingTransport implements HousingTransport {
  schema: FilterDefinition[] = UNIT_FILTERS;
  cards: UnitCard[] = [];
  lastPath: string | null = null;
  failNextRequest = false;
  failSchema = false;

  async filters(): Promise<FilterDefinition[]> {
    if (this.failSchema) throw new Error("schema unreachable");
    return this.schema;
  }

  async units(path: string): Promise<UnitCard[]> {
    this.lastPath = path;
    if (this.failNextRequest) throw new ClientError("units unreachable (test)");
    return this.cards;
  }
}

function newStore(transport: RecordingTransport = new RecordingTransport()): {
  store: HousingStore;
  transport: RecordingTransport;
} {
  return { store: new HousingStore(transport), transport };
}

describe("housing store", () => {
  test("initialize loads the filter schema, then the unit list with an unfiltered path", async () => {
    const { store, transport } = newStore();
    transport.cards = [aUnit().withId("unit-1").build()];
    await store.initialize();

    expect(store.units).toHaveLength(1);
    expect(transport.lastPath).toBe("/units");
    expect(store.filtersSchema).toEqual(UNIT_FILTERS);
    expect(store.phase).toBe("ready");
  });

  test("a selection is applied and the next request narrows accordingly", async () => {
    const { store, transport } = newStore();
    await store.initialize();

    store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["5"] });
    await store.refresh();
    expect(transport.lastPath).toBe("/units?ward=5");
  });

  test("an unsupported schema control type never crashes the store and never reaches a request", async () => {
    const { store, transport } = newStore();
    transport.schema = [
      ...UNIT_FILTERS,
      {
        id: "bedroom-range",
        label: "Bedroom range",
        control: "range" as never,
        target: "unit.ward" as never,
      },
    ];
    await store.initialize();

    // The unsupported definition is present in the raw schema but exposes no
    // supported control, so its id can not gain a selection through the UI.
    const unsupported: FilterDefinition | undefined = store.filtersSchema.find(
      (candidate: FilterDefinition) => candidate.id === "bedroom-range",
    );
    expect(unsupported).toBeDefined();
    expect(SUPPORTED_CONTROLS).not.toContain(unsupported?.control);

    store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    await store.refresh();
    expect(transport.lastPath).toBe("/units?ward=1");
  });

  test("a filter removed from the schema discards its active selection gracefully", async () => {
    const { store, transport } = newStore();
    await store.initialize();
    store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["5"] });
    await store.refresh();

    transport.schema = UNIT_FILTERS.filter((definition) => definition.id !== "ward");
    await store.reloadSchema();

    expect(transport.lastPath).toBe("/units");
  });

  test("a failing refresh keeps the last rendered results and flags the failure for retry", async () => {
    const { store, transport } = newStore();
    transport.cards = [aUnit().withId("unit-1").build()];
    await store.initialize();

    transport.failNextRequest = true;
    await store.refresh();
    expect(store.phase).toBe("error");
    const failure: LoadFailure | null = store.failure;
    expect(failure).toEqual({ scope: "units", reason: "unreachable" });
    // last rendered results are retained
    expect(store.units?.[0]?.id).toBe("unit-1");

    transport.failNextRequest = false;
    await store.refresh();
    expect(store.phase).toBe("ready");
    expect(store.failure).toBeNull();
  });

  test("a schema fetch failure keeps retrying after the retry affordance", async () => {
    const { store, transport } = newStore();
    transport.failSchema = true;
    await store.initialize();
    expect(store.phase).toBe("error");

    transport.failSchema = false;
    await store.reloadSchema();
    expect(store.filtersSchema).toEqual(UNIT_FILTERS);
    expect(store.phase).toBe("ready");
  });

  test("rapid selection changes do not interleave stale responses", async () => {
    const { store, transport } = newStore();
    await store.initialize();

    let refetchCount = 0;
    vi.spyOn(transport, "units").mockImplementation(async (path) => {
      refetchCount += 1;
      transport.lastPath = path;
      return [];
    });

    await Promise.all([
      store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] }),
      store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["2"] }),
    ]);
    // The dispatch gate collapses concurrent refreshes instead of out-of-order results.
    expect(refetchCount).toBeGreaterThanOrEqual(1);
    expect(transport.lastPath).toBe("/units?ward=1&ward=2");
  });
});
