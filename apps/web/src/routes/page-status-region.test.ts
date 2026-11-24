import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { SCHEMA_VERSION, SYNTHETIC_DISCLOSURE, UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnitCard } from "@dc-reentry/shared/testing";
import { afterEach, describe, expect, test, vi } from "vitest";
import { tick } from "svelte";
import { m } from "#lib/paraglide/messages.js";
import { housingStore } from "#lib/state/housing-store.svelte.ts";
import RootLayoutHarness from "./root-layout-disclosure.harness.svelte";

// jsdom provides no WebGL canvas, so the page's real MapView cannot mount a
// real MapLibre GL map here — only the GL engine is stubbed (see the
// disclosure-banner test for the same arrangement).
vi.mock("maplibre-gl", () => {
  class StubMap {
    on() {}
    addSource() {}
    addLayer() {}
    addImage() {}
    setFilter() {}
    flyTo() {}
    jumpTo() {}
    resize() {}
    setData() {}
    getLayer(): unknown {
      return undefined;
    }
    getSource(): unknown {
      return { setData() {}, setFilter() {} };
    }
    project(): { x: number; y: number } {
      return { x: 0, y: 0 };
    }
    queryRenderedFeatures(): unknown[] {
      return [];
    }
    remove() {}
  }
  return { Map: StubMap, setWorkerUrl: () => {} };
});

function okResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response;
}

/**
 * Serves the real published filter schema and a query-aware units list: a
 * `ward=8` selection matches nothing, any other selection (or none) matches
 * the two seeded units. `holdUnits` defers every units response until
 * released, so tests can observe the pending window.
 */
function stubBackend(units: unknown[]): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname === "/filters") {
      return okResponse({ schemaVersion: SCHEMA_VERSION, filters: UNIT_FILTERS });
    }
    if (url.pathname.startsWith("/units")) {
      const zeroMatches = url.search.includes("ward=8");
      return okResponse({
        schemaVersion: SCHEMA_VERSION,
        synthetic: true,
        disclosure: SYNTHETIC_DISCLOSURE,
        units: zeroMatches ? [] : [...units],
      });
    }
    throw new TypeError("fetch failed");
  });
}

function twoWard1Units(): unknown[] {
  return [
    aUnitCard().withId("unit-1").inWard(1).confirmed().build(),
    aUnitCard().withId("unit-2").inWard(1).confirmed().build(),
  ];
}

function statusRegion(): HTMLElement {
  return document.querySelector('p[role="status"]') as HTMLElement;
}

afterEach(() => {
  cleanup();
  // A failing fake-timer test must not leak fake timers into later tests.
  vi.useRealTimers();
  vi.unstubAllGlobals();
  housingStore.selection = Object.create(null);
  housingStore.units = null;
  housingStore.failure = null;
  housingStore.phase = "ready";
});

describe("the result-feedback status region", () => {
  test("nothing announces while the first units request is still loading, and the region appears when results land", async () => {
    // The boot effect re-runs initialize once the filter schema lands (it
    // tracks the schema), producing a coalesced second units request — the
    // hold must release every pending request so the store's refresh cycle
    // is free for the later tests.
    const pendingUnitResolves: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        if (url.pathname === "/filters") {
          return okResponse({ schemaVersion: SCHEMA_VERSION, filters: UNIT_FILTERS });
        }
        return new Promise<Response>((resolve) => {
          pendingUnitResolves.push(() =>
            resolve(
              okResponse({
                schemaVersion: SCHEMA_VERSION,
                synthetic: true,
                disclosure: SYNTHETIC_DISCLOSURE,
                units: [],
              }),
            ),
          );
        });
      }),
    );
    render(RootLayoutHarness);

    await screen.findByText(m.results_loading());
    expect(document.querySelector('[role="status"]')).toBeNull();

    for (const resolvePending of pendingUnitResolves.splice(0)) resolvePending();
    await waitFor(() => {
      expect(document.querySelector('[role="status"]')).not.toBeNull();
    });
    for (let round = 0; round < 5 && pendingUnitResolves.length > 0; round += 1) {
      for (const resolvePending of pendingUnitResolves.splice(0)) resolvePending();
      await tick();
    }
  });

  test("a count-changing apply announces only when the response lands, never a stale count while pending", async () => {
    const units = twoWard1Units();
    let holdUnits = false;
    const held: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        if (url.pathname === "/filters") {
          return okResponse({ schemaVersion: SCHEMA_VERSION, filters: UNIT_FILTERS });
        }
        if (url.pathname.startsWith("/units")) {
          const zeroMatches = url.search.includes("ward=8");
          const payload = okResponse({
            schemaVersion: SCHEMA_VERSION,
            synthetic: true,
            disclosure: SYNTHETIC_DISCLOSURE,
            units: zeroMatches ? [] : [...units],
          });
          if (!holdUnits) return payload;
          return new Promise<Response>((resolve) => held.push(() => resolve(payload)));
        }
        throw new TypeError("fetch failed");
      }),
    );
    render(RootLayoutHarness);

    await screen.findAllByRole("article", {}, { timeout: 5000 });
    const region = statusRegion();
    const original = region.textContent;
    expect(original).toContain("2 available unit");

    // One observer on the document body, keeping only records that target
    // the region: the recorded sequence IS the announcement history.
    const regionRecords: MutationRecord[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (region.contains(record.target)) regionRecords.push(record);
      }
    });
    observer.observe(document.body, {
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true,
    });

    // Hold the response: the selection writes immediately, the committed
    // result does not exist yet — nothing may announce in this window (no
    // stale count, no blanking).
    holdUnits = true;
    await userEvent.click(screen.getByRole("button", { name: "Ward 8" }));
    await tick();
    await tick();
    expect(regionRecords).toEqual([]);
    expect(region.textContent).toBe(original);

    // Response lands: exactly one record announces the new count.
    holdUnits = false;
    for (const release of held.splice(0)) release();
    await waitFor(() => expect(region.textContent).toContain("0 available unit"));
    await new Promise((r) => setTimeout(r, 25));
    expect(regionRecords.length).toBe(1);
    observer.disconnect();
  });

  test("a failed refresh mutates nothing in the status region", async () => {
    const units = twoWard1Units();
    let failNext = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        if (url.pathname === "/filters") {
          return okResponse({ schemaVersion: SCHEMA_VERSION, filters: UNIT_FILTERS });
        }
        if (url.pathname.startsWith("/units")) {
          if (failNext) throw new TypeError("fetch failed");
          return okResponse({
            schemaVersion: SCHEMA_VERSION,
            synthetic: true,
            disclosure: SYNTHETIC_DISCLOSURE,
            units: [...units],
          });
        }
        throw new TypeError("fetch failed");
      }),
    );
    render(RootLayoutHarness);

    await screen.findAllByRole("article", {}, { timeout: 5000 });
    const region = statusRegion();
    const before = region?.textContent;

    failNext = true;
    await userEvent.click(screen.getByRole("button", { name: "Ward 8" }));
    // The retry banner takes over; the last results (and the announcement) stay.
    await screen.findByText("We couldn't reach the housing service", { exact: false });
    expect(region.textContent).toBe(before);
  });

  test("an equal-count selection change re-announces, an unrelated refresh stays silent, and focus stays put", async () => {
    vi.stubGlobal("fetch", stubBackend(twoWard1Units()));
    render(RootLayoutHarness);

    await screen.findAllByRole("article", {}, { timeout: 5000 });
    const region = statusRegion();
    const original = region.textContent;
    expect(original).toContain("2 available unit");

    const regionRecords: MutationRecord[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (region.contains(record.target)) regionRecords.push(record);
      }
    });
    observer.observe(document.body, {
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true,
    });

    // Apply a selection that leaves the count identical: the region must
    // still announce (blank + restore across a macrotask).
    await userEvent.click(screen.getByRole("button", { name: "Ward 1" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ward 1" }));
    await waitFor(() => expect(region.textContent).toBe(original));
    await new Promise((r) => setTimeout(r, 50));

    // Exactly one blank and exactly one restore, and the blank was
    // observable (the characterData record carries the pre-blank text).
    expect(regionRecords.length).toBe(2);
    const blanked = regionRecords.some(
      (record) => record.oldValue === original || (record.target as Text).data === "",
    );
    expect(blanked, "the blank was observable").toBe(true);
    const mutationsAfterChange = regionRecords.length;

    // An unrelated refresh (same selection, same count) stays silent.
    await housingStore.refresh();
    await new Promise((r) => setTimeout(r, 50));
    expect(regionRecords.length).toBe(mutationsAfterChange);

    // Focus stayed on the toggle the whole time.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ward 1" }));
    observer.disconnect();
  });

  test(
    "a count-changing commit during a pending restore supersedes it without replaying the older text",
    { timeout: 15000 },
    async () => {
      const units = twoWard1Units();
      vi.stubGlobal("fetch", stubBackend(units));
      render(RootLayoutHarness);

      await screen.findAllByRole("article", {}, { timeout: 5000 });
      const region = statusRegion();

      const regionRecords: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (!region.contains(record.target)) continue;
          regionRecords.push((record.target as Text).data ?? "");
        }
      });
      observer.observe(region, { characterData: true, childList: true, subtree: true });

      // Fake timers: the identical-count commit's restore can never fire on
      // its own, so the count-changing commit deterministically lands DURING
      // the pending restore window.
      vi.useFakeTimers();
      const drainMicrotasks = async () => {
        for (let hop = 0; hop < 40; hop += 1) await Promise.resolve();
      };
      screen.getByRole("button", { name: "Ward 1" }).click();
      await drainMicrotasks();
      expect(region.textContent).toBe("");

      // Count-changing commit lands while the restore is pending: the newer
      // text supersedes (timer cleared) — the older count never replays.
      screen.getByRole("button", { name: "Ward 8" }).click();
      await drainMicrotasks();
      expect(region.textContent).toContain("0 available unit");
      expect(regionRecords, `seq=${JSON.stringify(regionRecords)}`).toEqual([
        "",
        "0 available unit(s) match your filters",
      ]);
      expect(regionRecords.filter((text) => text.includes("2 available"))).toEqual([]);

      // The supersede must also cancel the stale restore macrotask: run the
      // pending timers and confirm the region keeps the new count, with no
      // record re-introducing the older text after it.
      const timersPending = vi.getTimerCount();
      await vi.advanceTimersByTimeAsync(0);
      expect(
        region.textContent,
        `timers=${timersPending} seq=${JSON.stringify(regionRecords)}`,
      ).toContain("0 available unit");
      expect(
        regionRecords.filter((text) => text.includes("2 available")),
        `seq=${JSON.stringify(regionRecords)}`,
      ).toEqual([]);

      vi.useRealTimers();
      observer.disconnect();
    },
  );

  test("the equal-count blank persists across drained microtasks and is restored only by the macrotask", async () => {
    const units = twoWard1Units();
    vi.stubGlobal("fetch", stubBackend(units));
    render(RootLayoutHarness);

    await screen.findAllByRole("article", {}, { timeout: 5000 });
    const region = statusRegion();

    // Fake timers go live AFTER boot: RTL's own polling needs real timers.
    vi.useFakeTimers();

    // The identical-count commit blanks the region and schedules the
    // restore on a macrotask.
    screen.getByRole("button", { name: "Ward 1" }).click();
    // Drain the refresh chain's microtasks (the blank lands in the effect
    // that re-runs on the committed units).
    for (let hop = 0; hop < 40; hop += 1) await Promise.resolve();
    expect(region.textContent).toBe("");

    // Drained microtasks (no timers) never restore it — the blank persists,
    // pinning the macrotask as the restore mechanism.
    for (let hop = 0; hop < 40; hop += 1) await Promise.resolve();
    expect(region.textContent).toBe("");

    // Only the macrotask restores the announced text (the async advance
    // lets Svelte's DOM flush land before the read).
    const timerCount = vi.getTimerCount();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      region.textContent,
      `timers=${timerCount} text=${JSON.stringify(region.textContent)}`,
    ).toContain("2 available unit");
    vi.useRealTimers();
  });

  test("two identical-count commits reschedule the restore, pinning the newest signature", async () => {
    const units = twoWard1Units();
    vi.stubGlobal("fetch", stubBackend(units));
    render(RootLayoutHarness);

    await screen.findAllByRole("article", {}, { timeout: 5000 });
    const region = statusRegion();

    const regionRecords: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (!region.contains(record.target)) continue;
        regionRecords.push((record.target as Text).data ?? "");
      }
    });
    observer.observe(region, { characterData: true, childList: true, subtree: true });

    // Fake timers: a pending restore can never fire on its own, so the
    // second identical-count commit deterministically lands DURING the first
    // commit's pending restore window (not after both restores resolved).
    vi.useFakeTimers();
    const drainMicrotasks = async () => {
      for (let hop = 0; hop < 40; hop += 1) await Promise.resolve();
    };

    // First commit: identical count, changed selection — blanks the region
    // and schedules the restore (signature pinned: ward 1).
    screen.getByRole("button", { name: "Ward 1" }).click();
    await drainMicrotasks();
    expect(region.textContent).toBe("");

    // Second commit inside that pending window: identical count again — it
    // must reschedule the restore with the NEWEST signature (ward 1 + 5).
    screen.getByRole("button", { name: "Ward 5" }).click();
    await drainMicrotasks();
    expect(region.textContent).toBe("");

    // The restore lands exactly once, carrying the newest selection.
    await vi.advanceTimersByTimeAsync(0);
    expect(region.textContent, `seq=${JSON.stringify(regionRecords)}`).toContain(
      "2 available unit",
    );
    expect(regionRecords, `seq=${JSON.stringify(regionRecords)}`).toEqual([
      "",
      "2 available unit(s) match your filters",
    ]);

    // The recorded signature is ward 1 + ward 5: a later unrelated refresh
    // (same selection, same count) produces zero records — it must NOT
    // re-announce with the older, superseded signature.
    await housingStore.refresh();
    await drainMicrotasks();
    expect(regionRecords, `seq=${JSON.stringify(regionRecords)}`).toEqual([
      "",
      "2 available unit(s) match your filters",
    ]);
    observer.disconnect();
    vi.useRealTimers();
  });

  test(
    "a commit returning to the announced selection cancels the pending restore and keeps the announced signature",
    { timeout: 15000 },
    async () => {
      const units = twoWard1Units();
      vi.stubGlobal("fetch", stubBackend(units));
      render(RootLayoutHarness);

      await screen.findAllByRole("article", {}, { timeout: 5000 });
      const region = statusRegion();

      const regionRecords: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (!region.contains(record.target)) continue;
          regionRecords.push((record.target as Text).data ?? "");
        }
      });
      observer.observe(region, { characterData: true, childList: true, subtree: true });

      // Fake timers: the restore cannot fire on its own, so the return to
      // the announced selection deterministically lands DURING the pending
      // restore window.
      vi.useFakeTimers();
      const drainMicrotasks = async () => {
        for (let hop = 0; hop < 40; hop += 1) await Promise.resolve();
      };

      // Equal-count S1: blank + restore pending (the timer would record the
      // S1 signature when it fires).
      screen.getByRole("button", { name: "Ward 1" }).click();
      await drainMicrotasks();
      expect(region.textContent).toBe("");

      // Back to the ANNOUNCED selection before the timer fires: the toggle
      // empties the selection, whose signature matches the boot announcement.
      screen.getByRole("button", { name: "Ward 1" }).click();
      await drainMicrotasks();

      // Run the window out: exactly one blank and exactly one restore — the
      // announced text.
      await vi.advanceTimersByTimeAsync(0);
      expect(region.textContent).toContain("2 available unit");
      expect(regionRecords, `seq=${JSON.stringify(regionRecords)}`).toEqual([
        "",
        "2 available unit(s) match your filters",
      ]);

      // The recorded signature is the ANNOUNCED one (empty selection): a
      // later unrelated refresh stays silent.
      await housingStore.refresh();
      await drainMicrotasks();
      expect(regionRecords, `seq=${JSON.stringify(regionRecords)}`).toEqual([
        "",
        "2 available unit(s) match your filters",
      ]);
      observer.disconnect();
      vi.useRealTimers();
    },
  );

  test("one status region announces the count, follows apply and clear, and agrees with the zero panel", async () => {
    const units = twoWard1Units();
    vi.stubGlobal("fetch", stubBackend(units));
    render(RootLayoutHarness);

    await screen.findAllByRole("article", {}, { timeout: 5000 });

    // Exactly one live region, carrying the loaded count, never tabbable.
    const regions = document.querySelectorAll('[role="status"]');
    expect(regions).toHaveLength(1);
    const region = regions[0] as HTMLElement;
    expect(region).toHaveTextContent(m.results_count({ count: 2 }));
    expect(region.hasAttribute("tabindex")).toBe(false);
    // The visible count line is plain text now — no second announcer.
    expect(document.querySelector(".result-count")).not.toHaveAttribute("role");

    // Apply: Ward 8 matches nothing and the region agrees with the panel.
    units.length = 0;
    await userEvent.click(screen.getByRole("button", { name: "Ward 8" }));
    await screen.findByText(m.results_zero_headline());
    expect(region).toHaveTextContent(m.results_count({ count: 0 }));

    // Clear: the unfiltered count returns to the announcement.
    units.push(...twoWard1Units());
    await userEvent.click(screen.getByRole("button", { name: m.chip_clear_all() }));
    await screen.findAllByRole("article");
    expect(region).toHaveTextContent(m.results_count({ count: 2 }));
  });
});
