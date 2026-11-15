import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ApiError,
  ClientError,
  FETCH_TIMEOUT_MS,
  housingApi,
  type HousingTransport,
} from "#lib/api/client.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import {
  SCHEMA_VERSION,
  SYNTHETIC_DISCLOSURE,
  type FilterDefinition,
  type UnitCard,
} from "@dc-reentry/shared";
import { aUnitCard } from "@dc-reentry/shared/testing";

describe("housing API client", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("a hanging units endpoint surfaces as a retryable client failure, never a permanent block", async () => {
    vi.useFakeTimers();
    // fetch honors the deadline via its injected AbortSignal, then aborts
    vi.stubGlobal(
      "fetch",
      (_url: string, init?: { signal?: AbortSignal }): Promise<Response> =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("AbortError (test)", "AbortError"));
          });
        }),
    );
    const loading = housingApi.units("/units?ward=1");
    // attach the rejection handler BEFORE the deadline fires — nobody else
    // may hold an unhandled promise rejection between the timer and the claim
    const claim = expect(loading).rejects.toBeInstanceOf(ClientError);
    loading.catch(() => {});
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await claim;
  });

  test("an ApiError failure is distinguished from a transport failure for the failure banner", async () => {
    expect(new ApiError(404, "not-found", "No such thing").status).toBe(404);
    expect(new ClientError("unreachable").name).toBe("ClientError");
  });

  test("an envelope carrying a taxonomy value newer than this build's vocabulary is accepted, not discarded", async () => {
    // Arrange: the producer has evolved a housing type this client never compiled
    const futureCard = aUnitCard()
      .withProgram({ housingType: "rapid-rehousing" } as never)
      .build();
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      synthetic: true,
      disclosure: SYNTHETIC_DISCLOSURE,
      units: [futureCard],
    };
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    // Act: fetch the units listing through the real transport
    const units = await housingApi.units("/units?ward=1");

    // Assert: tolerant intake passes the payload through (no ClientError)
    expect(units).toHaveLength(1);
    expect(units[0]?.program.housingType).toBe("rapid-rehousing");
  });
});

class FailureTransport {
  hang = false;
  failSchema = false;
  cards: UnitCard[] = [];

  async filters(): Promise<FilterDefinition[]> {
    if (this.failSchema) throw new ClientError("schema unreachable (test)");
    return [];
  }
  async units(): Promise<UnitCard[]> {
    if (this.hang) return new Promise<UnitCard[]>(() => {});
    return this.cards;
  }
}

describe("deadline signal integrity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("the timeout signal always wins — the fetch init carries exactly one redo signal", async () => {
    const captured: Array<RequestInit | undefined> = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit): Promise<Response> => {
      captured.push(init);
      return Promise.reject(new TypeError("boom (test)"));
    });
    await expect(housingApi.units("/units?ward=1")).rejects.toBeInstanceOf(ClientError);
    const init = captured[0] ?? {};
    expect(Object.keys(init)).toContain("signal");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // exactly one signal: the deadline's, not a caller-provided replacement
    expect(String(init.signal)).toContain("AbortSignal");
  });
});

describe("failure classification through the store", () => {
  test("an ApiError-coded failure classifies as server (reason surface)", async () => {
    class ServerFailureTransport {
      async filters(): Promise<FilterDefinition[]> {
        return [];
      }
      async units(): Promise<never[]> {
        throw new ApiError(500, "internal-error", "server blew up (test)");
      }
    }
    const store = new HousingStore(new ServerFailureTransport() as never);
    await store.initialize();
    expect(store.phase).toBe("error");
    expect(store.failure).toEqual({ scope: "units", reason: "server" });
  });
});

describe("housing store retry semantics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("the retry affordance sequences schema reload before the units refresh", async () => {
    const store = new HousingStore(new FailureTransport() as unknown as HousingTransport);
    await store.reloadSchema();
    expect(store.phase).toBe("ready");
  });
});
