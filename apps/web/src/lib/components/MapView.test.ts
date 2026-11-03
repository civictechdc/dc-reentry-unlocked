import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/svelte";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { afterEach, describe, expect, test, vi } from "vitest";
import { tick } from "svelte";
import { m } from "#lib/paraglide/messages.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import {
  DC_MAP_CENTER,
  DC_MAP_ZOOM,
  highlightLayerFilter,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  unitsToFeatureCollection,
} from "#lib/map/map-config.ts";

/**
 * maplibre-gl is mocked in component tests (fast surface); the real-map
 * rendering proof comes from the Playwright e2e suite against the dev
 * server. The mock records the constructor arguments and every source/layer
 * mutation so the wrapper behavior is assertable.
 *
 * Event ordering is CONTROLLABLE so tests can drive first-load interleavings
 * the real map produces:
 * - `load` handlers are captured, never fired automatically; a test fires
 *   them explicitly with `fireLoad()` (the real map dispatches `load` once,
 *   only after the style loads — `fireLoad` clears the handlers to model
 *   that one-shot contract).
 * - `styleLoaded` is a plain flag the test sets, independent of load firing.
 *   The component no longer reads it (its guards key on source/layer
 *   existence), but tests keep setting it to arrange realistic maplibre
 *   state: `isStyleLoaded()` maps to `style.loaded()`, which is false while
 *   a newly added source is still settling (`_updatedSources` pending, its
 *   TileManager unloaded) — so the load handler's own `addSource`/`addLayer`
 *   calls flip it back to false for a window after load.
 */
const h = vi.hoisted(() => ({
  instances: [] as Array<{
    options: Record<string, unknown>;
    sources: Map<string, { data: unknown; setDataCount: number }>;
    layers: Array<Record<string, unknown>>;
    styleLoaded: boolean;
    fireLoad(): void;
    setFilterLog: unknown[];
    removed: boolean;
    clickPin: (unitId: string) => void;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class MockSource {
    data: unknown;
    setDataCount = 0;
    constructor(data: unknown) {
      this.data = data;
    }
    setData(data: unknown): void {
      this.data = data;
      this.setDataCount += 1;
    }
  }
  class MockMap {
    options: Record<string, unknown>;
    sources = new Map<string, MockSource>();
    layers: Array<Record<string, unknown>> = [];
    /** Test-controlled style state; the real map starts with the style NOT loaded. */
    styleLoaded = false;
    /** Captured `load` handlers — dispatched only when the test fires them. */
    loadHandlers: Array<() => void> = [];
    setFilterLog: unknown[] = [];
    removed = false;
    clickHandlers: unknown[] = [];

    constructor(options: Record<string, unknown>) {
      this.options = options;
      h.instances.push(this);
    }
    on(event: string, a: unknown, b?: unknown): void {
      if (event === "load" && typeof a === "function") {
        this.loadHandlers.push(a as () => void);
      } else if (event === "click" && typeof b === "function") {
        this.clickHandlers.push(b);
      }
    }
    /** Test helper: dispatch the captured `load` handlers once (the real `load` is one-shot). */
    fireLoad(): void {
      const handlers = this.loadHandlers;
      this.loadHandlers = [];
      for (const handler of handlers) handler();
    }
    isStyleLoaded(): boolean {
      return this.styleLoaded;
    }
    getSource(id: string): MockSource | undefined {
      return this.sources.get(id);
    }
    getLayer(id: string): Record<string, unknown> | undefined {
      return this.layers.find((layer) => layer.id === id);
    }
    addSource(id: string, definition: { data: unknown }): void {
      this.sources.set(id, new MockSource(definition.data));
    }
    addLayer(layer: Record<string, unknown>): void {
      this.layers.push(layer);
    }
    setFilter(_id: string, filter: unknown): void {
      this.setFilterLog.push(filter);
    }
    remove(): void {
      this.removed = true;
    }
    /** Test helper driving the layer-click path registered by the wrapper. */
    clickPin(unitId: string): void {
      for (const handler of this.clickHandlers) {
        (handler as (event: { features: unknown[] }) => void)({
          features: [{ properties: { id: unitId } }],
        });
      }
    }
  }
  return { Map: MockMap, setWorkerUrl: () => {} };
});

import MapView from "./MapView.svelte";

let store: HousingStore;
const unitInWard7 = aUnit()
  .withId("unit-exact")
  .inWard(7)
  .withCoordinates(38.9254, -77.0314)
  .build();
const unitInWard3 = aUnit()
  .withId("unit-ward3")
  .inWard(3)
  .withCoordinates(38.9364, -77.079)
  .build();

function freshStore(initialUnits: unknown[]): HousingStore {
  class FakeTransport {
    async filters() {
      return UNIT_FILTERS;
    }
    async units() {
      return initialUnits;
    }
  }
  return new HousingStore(new FakeTransport() as never);
}

/**
 * Mounts MapView over a store whose units are already resolved, then plays
 * the healthy first-load sequence: style finishes loading, `load` fires, the
 * load handler attaches the pin source with the current units.
 */
async function mountedMapWithResolvedUnits(units: unknown[]) {
  store = freshStore(units);
  await store.initialize();
  render(MapView, { props: { store } });
  await tick();
  const created = h.instances.at(0)!;
  created.styleLoaded = true;
  created.fireLoad();
  await tick();
  return created;
}

function pinnedUnitIds(created: { sources: Map<string, { data: unknown }> }): string[] {
  const collection = created.sources.get("units-pins")!.data as ReturnType<
    typeof unitsToFeatureCollection
  >;
  return collection.features.map((feature) => feature.properties.id);
}

afterEach(() => {
  cleanup();
  h.instances.length = 0;
  uiState.hoveredCardUnitId = null;
  uiState.hoveredPinUnitId = null;
  uiState.selectedUnitId = null;
});

describe("MapLibre map wrapper (mocked maplibre)", () => {
  test("creates the GL map on the OSM raster style with the required attribution", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);
    expect(created).toBeTruthy();
    const style = created.options.style as {
      sources: Record<string, { attribution: string; tiles: string[] }>;
    };
    expect(style.sources.osm?.tiles[0]).toBe(OSM_TILE_URL);
    expect(style.sources.osm?.attribution).toBe(OSM_ATTRIBUTION);
    expect(created.options.center).toEqual([DC_MAP_CENTER.lng, DC_MAP_CENTER.lat]);
    expect(created.options.zoom).toBe(DC_MAP_ZOOM);
  });

  test("renders one pin per unit in the shared GeoJSON source", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    expect(created.sources.get("units-pins")).toBeTruthy();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact", "unit-ward3"]);
  });

  test("pins re-render from the same result set: mutating the store restructures the shared source", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);
    expect(pinnedUnitIds(created)).toEqual(["unit-exact"]);

    // the REACTIVE path: a filter change swaps the result set, the wrapper re-renders pins
    store.units = [unitInWard7, unitInWard3];
    await tick();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact", "unit-ward3"]);
  });

  test("every pin feature sits at its unit's own exact coordinates", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    const collection = created.sources.get("units-pins")!.data as ReturnType<
      typeof unitsToFeatureCollection
    >;
    const featureById = new Map(
      collection.features.map((feature) => [feature.properties.id, feature]),
    );
    for (const unit of [unitInWard7, unitInWard3]) {
      expect(featureById.get(unit.id)?.geometry.coordinates).toEqual([
        unit.coordinates.longitude,
        unit.coordinates.latitude,
      ]);
    }
  });

  test("pin features carry no approximate-location marker", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    const collection = created.sources.get("units-pins")!.data as {
      features: Array<{ properties: Record<string, unknown> }>;
    };
    for (const feature of collection.features) {
      expect(feature.properties).not.toHaveProperty("approximate");
    }
  });

  test("pins paint with the single exact-pin style (no per-feature style branch)", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    const baseLayer = created.layers.find((layer) => layer.id === "units-pins-base");
    expect(baseLayer).toBeTruthy();
    const paint = baseLayer!.paint as Record<string, unknown>;
    expect(paint["circle-color"]).toBe("#0b5fab");
    expect(paint["circle-radius"]).toBe(6);
  });

  test("the legend lists only the exact-address pin meaning", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    const legend = document.querySelector(".map-legend")!;
    expect(legend.querySelectorAll(".legend-item")).toHaveLength(1);
    expect(legend.querySelector(".pin.approximate")).toBeNull();
    expect(legend.textContent).toContain(m.map_legend_exact());
    expect(legend.textContent ?? "").not.toMatch(/approximate/i);
  });

  test("hovering a card highlights its pin through the highlight-layer filter", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    uiState.hoveredCardUnitId = "unit-exact";
    await tick();
    const created = h.instances.at(0)!;
    expect(created.setFilterLog.at(-1)).toEqual(highlightLayerFilter("unit-exact"));
  });

  test("clicking a map pin highlights its CARD and opens the detail", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);

    created.clickPin("unit-exact");
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(created.setFilterLog.at(-1)).toEqual(highlightLayerFilter("unit-exact"));
  });

  test("the keyboard pin list selects a unit (focus highlight + click opens detail)", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    const pinButton = document.querySelector(
      '[data-testid="map-pin-list"] button',
    ) as HTMLButtonElement;
    expect(pinButton?.getAttribute("aria-label")).toContain(unitInWard7.address);

    pinButton!.focus();
    await tick();
    expect(uiState.hoveredCardUnitId).toBe("unit-exact");

    pinButton!.click();
    await tick();
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
  });

  test("hovering a card re-renders NO pins (setFilter owns the highlight paint)", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);
    const setDataBefore = (created.sources.get("units-pins") as { setDataCount?: number })
      ?.setDataCount;
    uiState.hoveredCardUnitId = "unit-exact";
    await tick();
    // the highlight filter moved, but the shared source was untouched
    expect(created.setFilterLog.length).toBeGreaterThan(0);
    expect((created.sources.get("units-pins") as { setDataCount?: number }).setDataCount).toBe(
      setDataBefore ?? 1,
    );
  });

  test("unmounting tears the GL map down", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    const mounted = render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    mounted.unmount();
    expect(created.removed).toBe(true);
  });
});

describe("first-load interleavings (regression pins)", () => {
  test("units resolving before load still pin every unit once load fires (the load handler reads the latest units)", async () => {
    // Mount while the units fetch is still in flight (the real page fires
    // `store.initialize()` without waiting, MapView mounts immediately).
    store = freshStore([unitInWard7]);
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    // `load` has not fired yet: no source exists, nothing to update.
    expect(created.sources.get("units-pins")).toBeUndefined();

    // The units fetch resolves while the map is still loading; the update
    // effect runs but the source does not exist yet — nothing to apply.
    await store.initialize();
    await tick();
    expect(created.sources.get("units-pins")).toBeUndefined();

    // The style finishes, `load` fires — and the handler reads the CURRENT
    // units, so the not-yet-applied change is overtaken by the initial attach.
    created.styleLoaded = true;
    created.fireLoad();
    await tick();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact"]);
  });

  test("units resolving after the source settled re-render every pin through the update path", async () => {
    store = freshStore([unitInWard7]);
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    // `load` fires BEFORE the units fetch resolves (cached style, slow API):
    // the source attaches with zero features, then the source settles (the
    // real style reports not-loaded during that settling — modeled below —
    // though the update path no longer consults the style's load state).
    created.styleLoaded = true;
    created.fireLoad();
    created.styleLoaded = false; // the load handler's addSource re-opens the style-loading window
    created.styleLoaded = true; // the newly added source settles; units still absent
    expect(pinnedUnitIds(created)).toEqual([]);

    // Units arrive AFTER the source settled: the source exists, so the
    // update effect applies the fetch result to it.
    await store.initialize();
    await tick();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact"]);
    expect((created.sources.get("units-pins") as { setDataCount: number }).setDataCount).toBe(1);
  });

  test("units resolving while the style reports loaded but load has not fired still pin every unit", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    // The style reports loaded one frame before `load` dispatches (real
    // maplibre: `load` fires inside a render frame, `style.loaded()` flips
    // earlier). The update effect runs but the source does not exist yet —
    // it applies nothing, and nothing is lost.
    created.styleLoaded = true;
    await tick();
    expect(created.sources.get("units-pins")).toBeUndefined();

    // `load` fires and the handler reads the CURRENT units, so this window
    // alone loses nothing.
    created.fireLoad();
    await tick();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact"]);
  });

  // Regression pin for the first-load pin drop: the real style reports NOT
  // loaded in the window after the load handler attaches the source (pending
  // source updates + settling tiles) — units arriving there must still reach
  // the source. The update path keys on source existence, never on the
  // style's load state; restore the old isStyleLoaded guard and this fails.
  test("units resolving in the style-reloading window after the source attaches land in the source while the style reports not-loaded", async () => {
    store = freshStore([unitInWard7]);
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    // `load` fires before the units fetch resolves (warm style, cold API).
    created.styleLoaded = true;
    created.fireLoad();
    // REAL maplibre: the load handler's own addSource + addLayer calls
    // re-open the style-loading window — `style.loaded()` returns false
    // while the added source's TileManager is still settling and its
    // `_updatedSources` entries are pending. Model that window:
    created.styleLoaded = false;

    // Units arrive INSIDE that window; the update effect runs.
    await store.initialize();
    await tick();

    expect((created.sources.get("units-pins") as { setDataCount: number }).setDataCount).toBe(1);
    expect(pinnedUnitIds(created)).toEqual(["unit-exact"]);
  });

  test("units arriving in the style-reloading window and the next result-set change both reach the source", async () => {
    store = freshStore([unitInWard7]);
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    created.styleLoaded = false; // the style-reloading window after addSource
    await store.initialize(); // units arrive inside the window
    await tick();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact"]);

    // The user picks a filter — the next result set replaces the first.
    store.units = [unitInWard7, unitInWard3];
    await tick();
    expect(pinnedUnitIds(created)).toEqual(["unit-exact", "unit-ward3"]);
    expect((created.sources.get("units-pins") as { setDataCount: number }).setDataCount).toBe(2);
  });
});
