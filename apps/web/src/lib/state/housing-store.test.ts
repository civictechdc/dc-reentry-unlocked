import { describe, expect, test } from "vitest";
import { UNIT_FILTERS, type FilterDefinition, type UnitCard } from "@dc-reentry/shared";
import { aUnitCard } from "@dc-reentry/shared/testing";
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

/** One in-flight response the test holds and releases by hand. */
type DeferredUnitResponse = {
  promise: Promise<UnitCard[]>;
  resolve: (cards: UnitCard[]) => void;
};

/**
 * Recording transport whose next armed unit request stays pending until the
 * test releases it — real promises, no timers, so the test controls exactly
 * when a response lands. Unarmed requests answer immediately.
 */
class DeferredRecordingTransport extends RecordingTransport {
  #armed: DeferredUnitResponse[] = [];

  /** Hold the next unit request: it stays pending until the handle resolves it. */
  holdNextResponse(): DeferredUnitResponse {
    let resolve!: (cards: UnitCard[]) => void;
    const promise = new Promise<UnitCard[]>((resolvePromise) => {
      resolve = resolvePromise;
    });
    const deferred = { promise, resolve };
    this.#armed.push(deferred);
    return deferred;
  }

  override async units(path: string): Promise<UnitCard[]> {
    this.lastPath = path;
    const deferred = this.#armed.shift();
    if (deferred) return deferred.promise;
    return this.cards;
  }
}

function newStore(transport: RecordingTransport = new RecordingTransport()): {
  store: HousingStore;
  transport: RecordingTransport;
} {
  return { store: new HousingStore(transport), transport };
}

/** One macrotask: every queued microtask (response delivery, drain loop) settles first — no fake timers. */
function afterTransportSettles(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("housing store", () => {
  test("initialize loads the filter schema, then the unit list with an unfiltered path", async () => {
    const { store, transport } = newStore();
    transport.cards = [aUnitCard().withId("unit-1").build()];
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
    transport.cards = [aUnitCard().withId("unit-1").build()];
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

  test("a selection made while a response is in flight renders the latest selection's results, never the stale first response", async () => {
    const transport = new DeferredRecordingTransport();
    const store = new HousingStore(transport);
    await store.initialize();

    const wardOneCards = [
      aUnitCard().withId("ward-1-first").inWard(1).build(),
      aUnitCard().withId("ward-1-second").inWard(1).build(),
    ];
    const wardTwoCards = [aUnitCard().withId("ward-2-only").inWard(2).build()];

    // The ward-1 response waits in flight until the test releases it.
    const inFlightWardOne = transport.holdNextResponse();
    store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    // The request for ward 1 is pending: the interface is mid-load.
    expect(store.phase).toBe("loading");

    // Ward 2 arrives mid-flight — the running cycle must drain it, not interleave it.
    // The apply's internal refresh coalesces onto the running cycle, so awaiting
    // the apply below waits for the drain to finish with no extra request.
    const wardTwoApplied = store.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["2"],
    });

    inFlightWardOne.resolve(structuredClone(wardOneCards));
    // The follow-up request fires only once the drain resumes: arm it before yielding.
    const inFlightWardTwo = transport.holdNextResponse();
    await afterTransportSettles();

    // Between the two responses the ward-1 cards render — the drain's intermediate write.
    expect(store.units).toEqual(wardOneCards);

    inFlightWardTwo.resolve(structuredClone(wardTwoCards));
    await wardTwoApplied;

    // The latest selection's payload lands last: a stale-first gate commits ward 1 here.
    expect(store.units).toEqual(wardTwoCards);
    expect(store.phase).toBe("ready");
    expect(transport.lastPath).toBe("/units?ward=1&ward=2");
  });
});
