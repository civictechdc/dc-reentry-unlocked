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
 */
const h = vi.hoisted(() => ({
  instances: [] as Array<{
    options: Record<string, unknown>;
    sources: Map<string, { data: unknown; setDataCount: number }>;
    layers: Array<Record<string, unknown>>;
    styleLoaded: boolean;
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
    styleLoaded = true;
    setFilterLog: unknown[] = [];
    removed = false;
    clickHandlers: unknown[] = [];

    constructor(options: Record<string, unknown>) {
      this.options = options;
      h.instances.push(this);
    }
    on(event: string, a: unknown, b?: unknown): void {
      if (event === "load" && typeof a === "function") {
        (a as () => void)();
      } else if (event === "click" && typeof b === "function") {
        this.clickHandlers.push(b);
      }
    }
    isStyleLoaded(): boolean {
      return this.styleLoaded;
    }
    getSource(id: string): MockSource | undefined {
      return this.sources.get(id);
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

afterEach(() => {
  cleanup();
  h.instances.length = 0;
  uiState.hoveredCardUnitId = null;
  uiState.hoveredPinUnitId = null;
  uiState.selectedUnitId = null;
});

describe("MapLibre map wrapper (mocked maplibre)", () => {
  test("creates the GL map on the OSM raster style with the required attribution", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0);
    expect(created).toBeTruthy();
    const style = created!.options.style as {
      sources: Record<string, { attribution: string; tiles: string[] }>;
    };
    expect(style.sources.osm?.tiles[0]).toBe(OSM_TILE_URL);
    expect(style.sources.osm?.attribution).toBe(OSM_ATTRIBUTION);
    expect(created!.options.center).toEqual([DC_MAP_CENTER.lng, DC_MAP_CENTER.lat]);
    expect(created!.options.zoom).toBe(DC_MAP_ZOOM);
  });

  test("renders one pin per unit in the shared GeoJSON source", async () => {
    store = freshStore([unitInWard7, unitInWard3]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
    const pinned = created.sources.get("units-pins");
    expect(pinned).toBeTruthy();
    const collection = pinned!.data as ReturnType<typeof unitsToFeatureCollection>;
    expect(collection.features).toHaveLength(2);
    expect(collection.features.map((feature) => feature.properties.id)).toEqual([
      "unit-exact",
      "unit-ward3",
    ]);
  });

  test("pins re-render from the same result set: mutating the store restructures the shared source", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
    const before = created.sources.get("units-pins")!.data as {
      features: { properties: { id: string } }[];
    };
    expect(before.features.map((feature) => feature.properties.id)).toEqual(["unit-exact"]);

    // the REACTIVE path: a filter change swaps the result set, the wrapper re-renders pins
    store.units = [unitInWard7, unitInWard3];
    await tick();
    const after = created.sources.get("units-pins")!.data as {
      features: { properties: { id: string } }[];
    };
    expect(after.features.map((feature) => feature.properties.id)).toEqual([
      "unit-exact",
      "unit-ward3",
    ]);
  });

  test("every pin feature sits at its unit's own exact coordinates", async () => {
    store = freshStore([unitInWard7, unitInWard3]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
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
    store = freshStore([unitInWard7, unitInWard3]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
    const collection = created.sources.get("units-pins")!.data as {
      features: Array<{ properties: Record<string, unknown> }>;
    };
    for (const feature of collection.features) {
      expect(feature.properties).not.toHaveProperty("approximate");
    }
  });

  test("pins paint with the single exact-pin style (no per-feature style branch)", async () => {
    store = freshStore([unitInWard7, unitInWard3]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
    const baseLayer = created.layers.find((layer) => layer.id === "units-pins-base");
    expect(baseLayer).toBeTruthy();
    const paint = baseLayer!.paint as Record<string, unknown>;
    expect(paint["circle-color"]).toBe("#0b5fab");
    expect(paint["circle-radius"]).toBe(6);
  });

  test("the legend lists only the exact-address pin meaning", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const legend = document.querySelector(".map-legend")!;
    expect(legend.querySelectorAll(".legend-item")).toHaveLength(1);
    expect(legend.querySelector(".pin.approximate")).toBeNull();
    expect(legend.textContent).toContain(m.map_legend_exact());
    expect(legend.textContent ?? "").not.toMatch(/approximate/i);
  });

  test("hovering a card highlights its pin through the highlight-layer filter", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    uiState.hoveredCardUnitId = "unit-exact";
    await tick();
    const created = h.instances.at(0)!;
    expect(created.setFilterLog.at(-1)).toEqual(highlightLayerFilter("unit-exact"));
  });

  test("clicking a map pin highlights its CARD and opens the detail", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
    created.clickPin("unit-exact");
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(created.setFilterLog.at(-1)).toEqual(highlightLayerFilter("unit-exact"));
  });

  test("the keyboard pin list selects a unit (focus highlight + click opens detail)", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

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
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
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
