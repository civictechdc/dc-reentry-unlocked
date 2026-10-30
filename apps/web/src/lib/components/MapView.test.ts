import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/svelte";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { afterEach, describe, expect, test, vi } from "vitest";
import { tick } from "svelte";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import { WARD_ANCHORS } from "#lib/map/ward-anchors.ts";
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
const unitInWard7 = aUnit().withId("unit-exact").inWard(7).build();
const approximateUnit = aUnit().withId("unit-approx").inWard(3).withApproximateLocation().build();

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
    store = freshStore([unitInWard7, approximateUnit]);
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
      "unit-approx",
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
    store.units = [unitInWard7, approximateUnit];
    await tick();
    const after = created.sources.get("units-pins")!.data as {
      features: { properties: { id: string } }[];
    };
    expect(after.features.map((feature) => feature.properties.id)).toEqual([
      "unit-exact",
      "unit-approx",
    ]);
  });

  test("approximate-location units place at their ward anchor (never coordinates-not-found)", async () => {
    store = freshStore([approximateUnit]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    const created = h.instances.at(0)!;
    const collection = created.sources.get("units-pins")!.data as ReturnType<
      typeof unitsToFeatureCollection
    >;
    const anchor = WARD_ANCHORS.find((entry) => entry.ward === 3)!;
    const feature = collection.features[0]!;
    expect(feature.geometry.coordinates).toEqual([anchor.longitude, anchor.latitude]);
    // visually distinct style characteristics
    expect(feature.properties.approximate).toBe(true);
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
