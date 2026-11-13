import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnitCard } from "@dc-reentry/shared/testing";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { tick } from "svelte";
import { m } from "#lib/paraglide/messages.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import {
  CARD_FOCUS_ZOOM,
  highlightLayerFilter,
  LOCALE_MAP_CENTER,
  LOCALE_MAP_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  pinCoordinatesFor,
  PIN_HOVER_INTENT_DELAY_MS,
  pinLabelLayerFilter,
  unitsToFeatureCollection,
  ZOOM_STEP,
} from "#lib/map/map-config.ts";
import { PIN_EXACT } from "#lib/map/map-colors.ts";

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
 *
 * Click dispatch mirrors the two maplibre registration shapes: layer-scoped
 * (`on("click", layerId, fn)`) handlers land in `clickHandlers` and fire via
 * `clickPin`; map-wide (`on("click", fn)` with no layer id) handlers land in
 * `mapWideClickHandlers` and fire via `clickCanvas`. A real physical click
 * fires BOTH groups — which group a test fires encodes what the hit-test
 * found under the pointer. `queryRenderedFeatures` is a stub returning the
 * test-settable `queryRenderedFeaturesResult` (default: no rendered features
 * under the query) while logging each call's point and options.
 * `dragSequence` plays a map drag: the captured pointer handlers
 * (mousedown/mousemove/mouseup) fire, but NO click handler does — MapLibre
 * suppresses the trailing `click` after a drag.
 */
const h = vi.hoisted(() => ({
  /**
   * Mock projection scale: canvas px per degree of lng/lat offset from the
   * camera readout. Shared by the MockMap `project` and the tests'
   * expected-projection helper so the two can never drift apart.
   */
  projectionUnitsPerDegree: 100,
  instances: [] as Array<{
    options: Record<string, unknown>;
    sources: Map<string, { data: unknown; setDataCount: number }>;
    layers: Array<Record<string, unknown>>;
    styleLoaded: boolean;
    fireLoad(): void;
    setFilterLog: unknown[];
    setLayoutPropertyLog: unknown[];
    addImageLog: Array<{
      id: string;
      seq: number;
      image: Record<string, unknown>;
      options: Record<string, unknown> | null;
    }>;
    addLayerLog: Array<{ id: string; seq: number }>;
    flyToLog: Array<Record<string, unknown>>;
    zoomToLog: number[];
    moveendHandlers: Array<() => void>;
    fireMoveEnd(): void;
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
    currentCenter: { lng: number; lat: number };
    currentZoom: number;
    removed: boolean;
    clickPin: (unitId: string) => void;
    clickCanvas: (x: number, y: number) => void;
    firePinHover: (unitId: string) => void;
    firePinMove: (unitId: string) => void;
    firePinLeave: () => void;
    dragSequence: (from: { x: number; y: number }, to: { x: number; y: number }) => void;
    queryRenderedFeaturesResult: Array<Record<string, unknown>>;
    queryRenderedFeaturesLog: Array<{ point: unknown; options: Record<string, unknown> | null }>;
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
  const pointerEventNames = new Set(["mousedown", "mousemove", "mouseup"]);
  class MockMap {
    options: Record<string, unknown>;
    sources = new Map<string, MockSource>();
    layers: Array<Record<string, unknown>> = [];
    /** Test-controlled style state; the real map starts with the style NOT loaded. */
    styleLoaded = false;
    /** Captured `load` handlers — dispatched only when the test fires them. */
    loadHandlers: Array<() => void> = [];
    /** Captured `moveend` handlers — dispatched only when the test fires them. */
    moveendHandlers: Array<() => void> = [];
    /** Filter changes: the target layer id recorded together with the filter. */
    setFilterLog: unknown[] = [];
    /** Layout mutations: layer id, property, value — never silently swallowed. */
    setLayoutPropertyLog: unknown[] = [];
    /** Registered images with a sequence number for add-order proofs. */
    addImageLog: Array<{
      id: string;
      seq: number;
      image: Record<string, unknown>;
      options: Record<string, unknown> | null;
    }> = [];
    /** Added layers with the same sequence counter — ordering is assertable. */
    addLayerLog: Array<{ id: string; seq: number }> = [];
    callSeq = 0;
    flyToLog: Array<Record<string, unknown>> = [];
    /** Camera zoom steps: the target zoom of each `zoomTo` call, in order. */
    zoomToLog: number[] = [];
    /** Test-settable camera readouts backing `getCenter()`/`getZoom()`. */
    currentCenter: { lng: number; lat: number } = { lng: 0, lat: 0 };
    currentZoom = 0;
    removed = false;
    clickHandlers: unknown[] = [];
    /** Registered map-wide click handlers: `on("click", fn)` with no layer id. */
    mapWideClickHandlers: unknown[] = [];
    /** Captured layer-scoped `mouseenter` handlers: `on("mouseenter", layerId, fn)`. */
    mouseEnterHandlers: Array<(event: { features: unknown[] }) => void> = [];
    /** Captured layer-scoped `mousemove` handlers: like `mouseenter`, the event carries `features`. */
    mouseMoveHandlers: Array<(event: { features: unknown[] }) => void> = [];
    /**
     * Captured layer-scoped `mouseleave` handlers. The real `mouseleave` is
     * a layer mouse event WITHOUT `features` — the queried feature set is
     * empty off-layer — and the component's leave handler ignores the event
     * entirely.
     */
    mouseLeaveHandlers: Array<(event: { features?: undefined }) => void> = [];
    /** Registered pointer handlers (mousedown/mousemove/mouseup), keyed by event name. */
    pointerHandlers = new Map<string, unknown[]>([
      ["mousedown", []],
      ["mousemove", []],
      ["mouseup", []],
    ]);
    /** Test-settable hit-test result backing `queryRenderedFeatures`; default is no hits. */
    queryRenderedFeaturesResult: Array<Record<string, unknown>> = [];
    /** Recorded `queryRenderedFeatures` calls: the queried point and options. */
    queryRenderedFeaturesLog: Array<{ point: unknown; options: Record<string, unknown> | null }> =
      [];

    constructor(options: Record<string, unknown>) {
      this.options = options;
      h.instances.push(this);
    }
    on(event: string, a: unknown, b?: unknown): void {
      if (event === "load" && typeof a === "function") {
        this.loadHandlers.push(a as () => void);
      } else if (event === "moveend" && typeof a === "function") {
        this.moveendHandlers.push(a as () => void);
      } else if (event === "click" && typeof b === "function") {
        this.clickHandlers.push(b);
      } else if (event === "click" && typeof a === "function") {
        this.mapWideClickHandlers.push(a);
      } else if (event === "mouseenter" && typeof b === "function") {
        this.mouseEnterHandlers.push(b as (event: { features: unknown[] }) => void);
      } else if (event === "mouseleave" && typeof b === "function") {
        this.mouseLeaveHandlers.push(b as (event: { features?: undefined }) => void);
      } else if (event === "mousemove" && typeof b === "function") {
        this.mouseMoveHandlers.push(b as (event: { features: unknown[] }) => void);
      } else if (typeof a === "function" && pointerEventNames.has(event)) {
        this.pointerHandlers.get(event)!.push(a);
      }
    }
    /** Test helper: dispatch the captured `load` handlers once (the real `load` is one-shot). */
    fireLoad(): void {
      const handlers = this.loadHandlers;
      this.loadHandlers = [];
      for (const handler of handlers) handler();
    }
    /** Test helper: dispatch the captured `moveend` handlers (the camera settled from a move). */
    fireMoveEnd(): void {
      for (const handler of this.moveendHandlers) handler();
    }
    flyTo(options: Record<string, unknown>): void {
      this.flyToLog.push(options);
    }
    zoomTo(zoom: number): void {
      this.zoomToLog.push(zoom);
      // The camera readout settles at the stepped zoom, like the real map's
      // animated zoom settling — a later `getZoom()` chains from it.
      this.currentZoom = zoom;
    }
    getCenter(): { lng: number; lat: number } {
      return this.currentCenter;
    }
    getZoom(): number {
      return this.currentZoom;
    }
    /**
     * Projection stand-in derived from the test-settable camera readout:
     * linear offsets from the current center (the real projection is a
     * nonlinear Web-Mercator sweep; the component tests need only points
     * that MOVE when the camera moves and DIFFER per unit — the magnitudes
     * are test-local, scaled by the shared `projectionUnitsPerDegree`).
     */
    project(lnglat: [number, number]): { x: number; y: number } {
      return {
        x: (lnglat[0] - this.currentCenter.lng) * h.projectionUnitsPerDegree,
        y: (this.currentCenter.lat - lnglat[1]) * h.projectionUnitsPerDegree,
      };
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
      this.addLayerLog.push({ id: layer.id as string, seq: ++this.callSeq });
    }
    addImage(id: string, image: Record<string, unknown>, options?: Record<string, unknown>): void {
      this.addImageLog.push({ id, seq: ++this.callSeq, image, options: options ?? null });
    }
    setFilter(id: string, filter: unknown): void {
      this.setFilterLog.push({ layerId: id, filter });
      // The stored layer reflects the latest call, like the real map.
      const layer = this.layers.find((candidate) => candidate.id === id);
      if (layer) layer.filter = filter;
    }
    setLayoutProperty(id: string, property: string, value: unknown): void {
      this.setLayoutPropertyLog.push({ layerId: id, property, value });
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
    /** Test helper: dispatch the captured map-wide click handlers with a pixel point. */
    clickCanvas(x: number, y: number): void {
      for (const handler of this.mapWideClickHandlers) {
        (handler as (event: { point: { x: number; y: number } }) => void)({ point: { x, y } });
      }
    }
    /**
     * Test helper: dispatch the captured layer-scoped `mouseenter` handlers
     * with one queried pin feature — the real event carries the `features`
     * under the pointer.
     */
    firePinHover(unitId: string): void {
      for (const handler of this.mouseEnterHandlers) {
        handler({ features: [{ properties: { id: unitId } }] });
      }
    }
    /**
     * Test helper: dispatch the captured layer-scoped `mouseleave` handlers.
     * The real `mouseleave` carries no `features` — the handler must already
     * know what it is clearing.
     */
    firePinLeave(): void {
      for (const handler of this.mouseLeaveHandlers) handler({});
    }
    /**
     * Test helper: dispatch the captured layer-scoped `mousemove` handlers
     * with one queried pin feature. MapLibre's layer-scoped `mouseenter`
     * does NOT re-fire when the pointer crosses between features of the
     * same layer — pin-to-pin travel inside one layer arrives as plain
     * `mousemove` events carrying the feature now under the pointer.
     */
    firePinMove(unitId: string): void {
      for (const handler of this.mouseMoveHandlers) {
        handler({ features: [{ properties: { id: unitId } }] });
      }
    }
    /** Test helper: fire one captured pointer-handler group with a pixel point. */
    firePointer(event: string, point: { x: number; y: number }): void {
      for (const handler of this.pointerHandlers.get(event) ?? []) {
        (handler as (event: { point: { x: number; y: number } }) => void)({ point });
      }
    }
    /**
     * Test helper: play a map drag from one point to another. The captured
     * pointer handlers receive mousedown, moves, and mouseup, but NO click
     * handler fires — MapLibre suppresses the trailing `click` after a drag —
     * so a drag must never reach the click-driven behavior.
     */
    dragSequence(from: { x: number; y: number }, to: { x: number; y: number }): void {
      const midX = from.x + (to.x - from.x) / 2;
      const midY = from.y + (to.y - from.y) / 2;
      this.firePointer("mousedown", from);
      this.firePointer("mousemove", { x: midX, y: midY });
      this.firePointer("mousemove", to);
      this.firePointer("mouseup", to);
    }
    /** The hit-test stub backing the wrapper's `queryRenderedFeatures` calls. */
    queryRenderedFeatures(
      point?: { x: number; y: number },
      options?: { layers?: string[] },
    ): unknown[] {
      this.queryRenderedFeaturesLog.push({ point, options: options ?? null });
      return this.queryRenderedFeaturesResult;
    }
  }
  return { Map: MockMap, setWorkerUrl: () => {} };
});

import DetailSlideOver from "./DetailSlideOver.svelte";
import MapView from "./MapView.svelte";
import UnitCard from "./UnitCard.svelte";

let store: HousingStore;
const unitInWard7 = aUnitCard()
  .withId("unit-exact")
  .inWard(7)
  .withCoordinates(38.9254, -77.0314)
  .build();
const unitInWard3 = aUnitCard()
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

/** The filter of the last `setFilter` call aimed at one layer. */
function lastFilterFor(created: { setFilterLog: unknown[] }, layerId: string): unknown {
  const entries = created.setFilterLog as Array<{ layerId: string; filter: unknown }>;
  return entries.filter((entry) => entry.layerId === layerId).at(-1)?.filter;
}

/**
 * The card list renders one unit card per unit; each card's button is found
 * through the unit's labelled title inside the card article. This drives the
 * card's REAL handlers (click, pointer hover, keyboard focus) — raw uiState
 * writes would bypass the code under test.
 */
function cardButtonFor(unitId: string): HTMLButtonElement {
  const article = document.getElementById(`card-title-${unitId}`)?.closest("article");
  const button = article?.querySelector("button");
  if (!button) throw new Error(`card button for unit ${unitId} not found`);
  return button as HTMLButtonElement;
}

/**
 * Page-chrome stubs: the real page wraps the card list in a `.list-pane`
 * div, the filter controls in a `.filter-bar`, and the phone tabs in a
 * `.mobile-bar` div. Component tests mount the map alone, so chrome is
 * stubbed with elements appended to `document.body` — they give the
 * map's off-map click dismissal its keep-alive targets (a card click only
 * survives when it bubbles through the same `.list-pane` class the live
 * page uses). Removed after every test by the file's afterEach.
 */
const chromeStubs: Array<HTMLElement> = [];

function chromeStub(className: string): HTMLElement {
  const stub = document.createElement("div");
  stub.className = className;
  document.body.append(stub);
  chromeStubs.push(stub);
  return stub;
}

function removeChromeStubs(): void {
  for (const stub of chromeStubs) stub.remove();
  chromeStubs.length = 0;
}

afterEach(() => {
  cleanup();
  removeChromeStubs();
  vi.unstubAllGlobals();
  h.instances.length = 0;
  uiState.hoveredCardUnitId = null;
  uiState.hoveredPinUnitId = null;
  uiState.selectedUnitId = null;
  uiState.detailTriggerElement = null;
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
    expect(created.options.center).toEqual([LOCALE_MAP_CENTER.lng, LOCALE_MAP_CENTER.lat]);
    expect(created.options.zoom).toBe(LOCALE_MAP_ZOOM);
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
    expect(paint["circle-color"]).toBe(PIN_EXACT);
    expect(paint["circle-radius"]).toBe(6);
  });

  test("the legend lists only the available-unit pin meaning", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    const legend = document.querySelector(".map-legend")!;
    expect(legend.querySelectorAll(".legend-item")).toHaveLength(1);
    expect(legend.querySelector(".pin.approximate")).toBeNull();
    expect(legend.textContent).toContain(m.map_legend_unit());
    expect(legend.textContent ?? "").not.toMatch(/approximate/i);
  });

  test("hovering a card highlights its pin through the highlight-layer filter", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    uiState.hoveredCardUnitId = "unit-exact";
    await tick();
    const created = h.instances.at(0)!;
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-exact"),
    );
  });

  test("clicking a map pin highlights its CARD and opens the detail", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);

    created.clickPin("unit-exact");
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-exact"),
    );
    // the canvas-pin click path focuses the camera exactly like card selection
    expect(created.flyToLog.at(-1)).toEqual({
      center: pinCoordinatesFor(unitInWard7),
      zoom: CARD_FOCUS_ZOOM,
    });
  });

  test("the keyboard pin list selects a unit (focus highlights its card, activation opens the detail, and the canvas-pin hover id clears)", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    const pinButton = document.querySelector(
      '[data-testid="map-pin-list"] button',
    ) as HTMLButtonElement;
    expect(pinButton?.getAttribute("aria-label")).toContain(unitInWard7.address);

    pinButton!.focus();
    await tick();
    expect(uiState.hoveredCardUnitId).toBe("unit-exact");

    // The pin button is a keyboard path, not a canvas pin: activation keeps
    // focus highlight and selection, but clears any canvas-pin hover id (the
    // selection it sets owns the label fallback itself).
    pinButton!.click();
    await tick();
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(uiState.hoveredPinUnitId).toBeNull();
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

describe("click-off dismissal", () => {
  test("clicking empty canvas clears the card hover, the pin hover, and the selection, and filters the label layer to the explicit no-match", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    created.clickPin("unit-exact");
    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();

    // No pin is rendered under the click point.
    created.queryRenderedFeaturesResult = [];
    created.clickCanvas(20, 30);
    await tick();

    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBeNull();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
  });

  test("a click on a pin does not clear: the state stays with the pin-click path and the label keeps its unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    created.clickPin("unit-exact");
    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();

    // A pin IS rendered under the click point; the dismissal hit-test must
    // consult exactly the base pin layer.
    created.queryRenderedFeaturesResult = [{ properties: { id: "unit-exact" } }];
    created.clickCanvas(20, 30);
    await tick();

    expect(created.queryRenderedFeaturesLog.at(-1)).toEqual({
      point: { x: 20, y: 30 },
      options: { layers: ["units-pins-base"] },
    });
    expect(uiState.hoveredCardUnitId).toBe("unit-ward3");
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
    // the identity is unchanged: the card hover still wins over the selection
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("a canvas click while the map is still loading is inert: the pre-existing selection survives and the pin hit-test never runs", async () => {
    // Raw render, no `load` fired: the pin layers do not exist yet, the way
    // a freshly mounted map sits while its style is still loading.
    store = freshStore([unitInWard7]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;

    // A selection can pre-exist at mount (the map unmounts while the list
    // tab is active and remounts with the detail still open), together with
    // a card hover from pointer movement over the card list.
    uiState.selectedUnitId = "unit-exact";
    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();

    created.clickCanvas(20, 30);
    await tick();

    expect(uiState.hoveredCardUnitId).toBe("unit-ward3");
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBe("unit-exact");
    // querying a not-yet-existing layer would be a maplibre error: the
    // hit-test must never run before the pin layer exists
    expect(created.queryRenderedFeaturesLog).toEqual([]);
  });

  test("a map drag never dismisses: pointer movement without a trailing click keeps the selection, through the map and through the raw canvas DOM", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    created.clickPin("unit-exact");
    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();

    // MapLibre suppresses the `click` that trails a completed drag: the
    // drag sequence fires mousedown/mousemove/mouseup and NO click.
    created.dragSequence({ x: 10, y: 10 }, { x: 60, y: 60 });
    await tick();

    expect(uiState.hoveredCardUnitId).toBe("unit-ward3");
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));

    // Raw DOM pointer events on the canvas container (still no click) must
    // not dismiss either — dismissal is bound to click, never to pointer
    // events.
    const canvas = document.querySelector(".map-canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 60, clientY: 60 }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await tick();

    expect(uiState.hoveredCardUnitId).toBe("unit-ward3");
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
  });
});

describe("off-map click dismissal", () => {
  /**
   * Mounts the map, every unit's card in its page-chrome list-pane stub,
   * and the detail slide-over together: the off-map proofs need a live
   * selection call site (canvas pin, card button) feeding the slide-over
   * that closes, all sharing the uiState singleton. Filter-bar and
   * mobile-bar chrome is stubbed per test with `chromeStub`.
   */
  async function mountedMapCardsAndDetail(units: unknown[]) {
    store = freshStore(units);
    await store.initialize();
    render(MapView, { props: { store } });
    const listPane = chromeStub("list-pane");
    for (const unit of store.units ?? []) {
      render(UnitCard, { props: { card: unit }, target: listPane });
    }
    render(DetailSlideOver, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    await tick();
    return created;
  }

  /** A focusable button inside a stubbed chrome pane, ready to be clicked. */
  function chromeButtonIn(className: string): HTMLButtonElement {
    const button = document.createElement("button");
    chromeStub(className).append(button);
    return button;
  }

  test("clicking a filter-bar control outside the map clears the card hover, the pin hover, and the selection: the detail closes and the label filters to the no-match", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const filterButton = chromeButtonIn("filter-bar");

    // selection and label active: a canvas pin click opens the detail…
    created.clickPin("unit-exact");
    await tick();
    // …and a live card hover owns the label above the selection
    cardButtonFor(unitInWard3.id).dispatchEvent(new MouseEvent("pointerenter"));
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));

    await userEvent.click(filterButton);
    await tick();

    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBeNull();
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(highlightLayerFilter(null));
  });

  test("clicking bare page background dismisses identically: the selection and both hovers clear and the open detail closes", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    // a page-background element: no keep-alive chrome class anywhere above it
    const background = document.createElement("div");
    document.body.append(background);
    chromeStubs.push(background);

    created.clickPin("unit-exact");
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    await userEvent.click(background);
    await tick();

    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBeNull();
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
  });

  test("clicking a unit card in the list pane does not dismiss: the open selection moves to the clicked card and the detail stays open", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);

    created.clickPin("unit-exact");
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    // the card click bubbles through the `.list-pane` chrome: the dismissal
    // must stay out of the way while the card's own handler selects the unit
    await userEvent.click(cardButtonFor(unitInWard3.id));
    await tick();

    expect(uiState.selectedUnitId).toBe("unit-ward3");
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("clicking inside the open detail panel does not dismiss: the selection and the panel survive", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);

    created.clickPin("unit-exact");
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    // a click on the panel body — never a close control — bubbles through
    // the `.detail` chrome, and the detail's own content stays interactive
    screen.getByTestId("unit-detail").click();
    await tick();

    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-exact"));
  });

  test("clicking the phone tab bar does not dismiss: tab switching keeps the selection", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const tabButton = chromeButtonIn("mobile-bar");

    created.clickPin("unit-exact");
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    tabButton.click();
    await tick();

    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-exact"));
  });

  test("an off-map dismissal does not yank focus back to the opener: the control the click activated keeps the focus", async () => {
    await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const filterButton = chromeButtonIn("filter-bar");

    const opener = cardButtonFor(unitInWard7.id);
    await userEvent.click(opener);
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    // the freshly opened panel grabbed focus, so a passing proof must be
    // active non-restoration — never inherited opener focus
    expect(document.activeElement).not.toBe(opener);

    await userEvent.click(filterButton);
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(uiState.selectedUnitId).toBeNull();
    // the focus-return trigger is dropped, not spent on the opener
    expect(uiState.detailTriggerElement).toBeNull();
    expect(document.activeElement).toBe(filterButton);
  });
});

describe("address label lifecycle", () => {
  test("hovering a card moves both the highlight filter and the label filter to that unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();

    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-ward3"),
    );
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("hovering a canvas pin moves both the highlight filter and the label filter to that unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    uiState.hoveredPinUnitId = "unit-ward3";
    await tick();

    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-ward3"),
    );
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
    // the stored label layer mirrors the latest call, like the real map
    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("the label layer attaches above both pin circle layers so labels paint over the circles", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    const layerIds = created.layers.map((layer) => layer.id);
    const labelIndex = layerIds.indexOf("units-pins-label");
    expect(labelIndex).toBeGreaterThan(layerIds.indexOf("units-pins-base"));
    expect(labelIndex).toBeGreaterThan(layerIds.indexOf("units-pins-highlight"));
  });

  test("an open detail with no hover keeps both filters on the selected unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    uiState.selectedUnitId = "unit-ward3";
    await tick();

    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-ward3"),
    );
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
    // the stored layer mirrors the latest call, like the real map
    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("a card hover overrides the open selection's filters and clearing the hover restores the selection", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    uiState.selectedUnitId = "unit-exact";
    await tick();
    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-ward3"),
    );

    uiState.hoveredCardUnitId = null;
    await tick();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-exact"));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-exact"),
    );
  });

  test("closing the detail filters the label layer to the explicit no-match and never null", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);

    uiState.selectedUnitId = "unit-exact";
    await tick();
    uiState.selectedUnitId = null;
    uiState.hoveredPinUnitId = null;
    uiState.hoveredCardUnitId = null;
    await tick();

    const labelEntries = (
      created.setFilterLog as Array<{ layerId: string; filter: unknown }>
    ).filter((entry) => entry.layerId === "units-pins-label");
    expect(labelEntries.length).toBeGreaterThan(0);
    for (const entry of labelEntries) {
      expect(entry.filter).not.toBeNull();
      expect(Array.isArray(entry.filter)).toBe(true);
    }
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter(null));
  });

  test("a remount while a selection is live attaches the label layer already filtered to that unit", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    uiState.selectedUnitId = unitInWard7.id;
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    await tick();

    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer).toBeTruthy();
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter(unitInWard7.id));
    expect(labelLayer?.type).toBe("symbol");
  });

  test("the bubble image and its metadata reach the public addImage with the right shapes", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);

    const created = h.instances.at(0)!;
    const imageEntry = created.addImageLog.find((entry) => entry.id === "pin-label-bubble");
    const labelLayerEntry = created.addLayerLog.find((entry) => entry.id === "units-pins-label");
    expect(imageEntry, "the bubble bitmap is registered").toBeTruthy();
    expect(labelLayerEntry, "the label layer is attached").toBeTruthy();
    // a symbol layer referencing an unregistered image draws nothing
    expect(imageEntry!.seq).toBeLessThan(labelLayerEntry!.seq);
    // argument fidelity to the PUBLIC addImage signature: the image object
    // carries geometry and bytes only; the metadata travels in the options
    expect(Object.keys(imageEntry!.image).sort()).toEqual(["data", "height", "width"]);
    expect(imageEntry!.image.data).toBeInstanceOf(Uint8Array);
    const options = imageEntry!.options as Record<string, unknown>;
    expect(options.pixelRatio).toBe(2);
    expect(options.sdf).toBe(false);
    expect(options.stretchX).toEqual([
      [10, 29],
      [58, 77],
    ]);
    expect(options.stretchY).toEqual([[2, 30]]);
    expect(options.content).toEqual([10, 2, 78, 30]);
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

describe("card selection focuses the map", () => {
  test("selecting a unit flies the camera to its pin at the card-focus zoom", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    uiState.selectedUnitId = unitInWard7.id;
    await tick();

    expect(created.flyToLog).toEqual([
      { center: pinCoordinatesFor(unitInWard7), zoom: CARD_FOCUS_ZOOM },
    ]);
  });

  test("activating the unit's keyboard pin button focuses the camera identically to card selection", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    const pinButton = document.querySelector(
      '[data-testid="map-pin-list"] button',
    ) as HTMLButtonElement;
    pinButton.click();
    await tick();

    expect(created.flyToLog).toEqual([
      { center: pinCoordinatesFor(unitInWard7), zoom: CARD_FOCUS_ZOOM },
    ]);
  });

  test("a selection pre-existing at mount opens the camera already focused on the unit's pin with no redundant flyTo", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    uiState.selectedUnitId = unitInWard7.id;
    render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;

    expect(created.options.center).toEqual(pinCoordinatesFor(unitInWard7));
    expect(created.options.zoom).toBe(CARD_FOCUS_ZOOM);
    expect(created.flyToLog).toEqual([]);
  });

  test("no selection at mount keeps the locale default initial view", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);

    expect(created.options.center).toEqual([LOCALE_MAP_CENTER.lng, LOCALE_MAP_CENTER.lat]);
    expect(created.options.zoom).toBe(LOCALE_MAP_ZOOM);
    expect(created.flyToLog).toEqual([]);
  });

  test("the section reports the camera center and zoom, refreshed when the map settles from a move", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);

    const section = document.querySelector('[data-testid="map-view"]')!;
    expect(section.getAttribute("data-map-center")).toBe(
      `${LOCALE_MAP_CENTER.lng},${LOCALE_MAP_CENTER.lat}`,
    );
    expect(section.getAttribute("data-map-zoom")).toBe(String(LOCALE_MAP_ZOOM));

    // The camera moved (as after a flyTo animation) and settles: moveend fires.
    created.currentCenter = {
      lng: unitInWard7.coordinates.longitude,
      lat: unitInWard7.coordinates.latitude,
    };
    created.currentZoom = CARD_FOCUS_ZOOM;
    created.fireMoveEnd();
    await tick();

    expect(section.getAttribute("data-map-center")).toBe(
      `${unitInWard7.coordinates.longitude},${unitInWard7.coordinates.latitude}`,
    );
    expect(section.getAttribute("data-map-zoom")).toBe(String(CARD_FOCUS_ZOOM));
  });

  test("selecting a unit id absent from the result set flies nowhere", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);

    uiState.selectedUnitId = "unit-not-in-results";
    await tick();

    expect(created.flyToLog).toEqual([]);
  });
});

describe("pin-point and label-unit observability", () => {
  /**
   * Reads the map section's serialized pin-point attribute: `"<x>,<y>;…"`
   * parses to canvas-local number pairs, and the empty string (nothing
   * rendered) parses to `[]`.
   */
  function readPinPointsAttribute(): Array<[number, number]> {
    const raw =
      document.querySelector('[data-testid="map-view"]')?.getAttribute("data-pin-points") ?? "";
    return raw
      .split(";")
      .filter((pair) => pair !== "")
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return [x ?? Number.NaN, y ?? Number.NaN] as [number, number];
      });
  }

  /** Reads the live address-label unit id from the observability attribute. */
  function readLabelUnitAttribute(): string | null {
    return (
      document.querySelector('[data-testid="map-view"]')?.getAttribute("data-label-unit") ?? null
    );
  }

  /**
   * The mock projection's expected canvas-local point for a lnglat under the
   * map instance's CURRENT camera readout — the same arithmetic the MockMap
   * `project` performs, through the shared scale constant.
   */
  function expectedProjection(
    created: { currentCenter: { lng: number; lat: number } },
    lnglat: [number, number],
  ): [number, number] {
    return [
      (lnglat[0] - created.currentCenter.lng) * h.projectionUnitsPerDegree,
      (created.currentCenter.lat - lnglat[1]) * h.projectionUnitsPerDegree,
    ];
  }

  /** Both coordinates of one parsed pin point sit on its expected values. */
  function expectPointClose(
    actual: [number, number] | undefined,
    expected: [number, number],
  ): void {
    expect(actual).toBeDefined();
    expect(actual![0]).toBeCloseTo(expected[0]);
    expect(actual![1]).toBeCloseTo(expected[1]);
  }

  test("before the map fires load the pin points attribute reads honestly empty", async () => {
    store = freshStore([unitInWard7, unitInWard3]);
    await store.initialize();
    render(MapView, { props: { store } });
    await tick();

    // The pin source attaches on `load`; until then nothing renders, so the
    // attribute must be the empty string rather than projections of pins
    // that do not exist yet.
    expect(
      document.querySelector('[data-testid="map-view"]')?.getAttribute("data-pin-points"),
    ).toBe("");
  });

  test("the section reports every rendered pin's projected canvas center, re-projected when the camera settles from a move", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    // Arrange a known settled camera: the locale default view.
    created.currentCenter = { lng: LOCALE_MAP_CENTER.lng, lat: LOCALE_MAP_CENTER.lat };
    created.fireMoveEnd();
    await tick();

    const points = readPinPointsAttribute();
    expect(points).toHaveLength(2);
    expectPointClose(points.at(0), expectedProjection(created, pinCoordinatesFor(unitInWard7)));
    expectPointClose(points.at(1), expectedProjection(created, pinCoordinatesFor(unitInWard3)));

    // The camera moves (as after a flyTo animation) and settles on the
    // ward-7 pin: every reported point re-projects under the new camera, the
    // centered pin landing at the canvas origin.
    created.currentCenter = {
      lng: unitInWard7.coordinates.longitude,
      lat: unitInWard7.coordinates.latitude,
    };
    created.fireMoveEnd();
    await tick();

    const moved = readPinPointsAttribute();
    expect(moved).toHaveLength(2);
    expectPointClose(moved.at(0), [0, 0]);
    expectPointClose(moved.at(1), expectedProjection(created, pinCoordinatesFor(unitInWard3)));
  });

  test("swapping the result set re-projects the reported pin points to exactly the new rendered set", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7]);
    expect(readPinPointsAttribute()).toHaveLength(1);

    // A filter change swaps the result set: the update path re-renders pins…
    store.units = [unitInWard7, unitInWard3];
    await tick();

    // …and the reported points track exactly the new set, under the
    // unchanged camera readout.
    const points = readPinPointsAttribute();
    expect(points).toHaveLength(2);
    expectPointClose(points.at(0), expectedProjection(created, pinCoordinatesFor(unitInWard7)));
    expectPointClose(points.at(1), expectedProjection(created, pinCoordinatesFor(unitInWard3)));
  });

  test("an emptied result set leaves the pin points attribute honestly empty", async () => {
    await mountedMapWithResolvedUnits([unitInWard7]);
    expect(readPinPointsAttribute()).toHaveLength(1);

    store.units = [];
    await tick();

    expect(readPinPointsAttribute()).toEqual([]);
  });

  test("with no hover and no selection the label-unit attribute reads none", async () => {
    await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    expect(readLabelUnitAttribute()).toBe("none");
  });

  test("a selection pre-existing at mount reports the selected unit as the live label owner", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    uiState.selectedUnitId = unitInWard7.id;
    render(MapView, { props: { store } });
    await tick();

    expect(readLabelUnitAttribute()).toBe("unit-exact");
  });

  test("resting the pointer on a canvas pin past the intent delay moves the label-unit attribute to that pin's unit, and leaving with no selection returns it to none", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    expect(readLabelUnitAttribute()).toBe("none");

    vi.useFakeTimers();
    try {
      created.firePinHover("unit-ward3");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS);
    } finally {
      vi.useRealTimers();
    }
    await tick();
    expect(readLabelUnitAttribute()).toBe("unit-ward3");

    created.firePinLeave();
    await tick();
    expect(readLabelUnitAttribute()).toBe("none");
  });

  test("the label-unit attribute reports the resolved owner: a card hover over an open selection moves it to the hovered unit, and clearing the hover restores the selection", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    created.clickPin("unit-exact");
    await tick();
    expect(readLabelUnitAttribute()).toBe("unit-exact");

    uiState.hoveredCardUnitId = "unit-ward3";
    await tick();
    expect(readLabelUnitAttribute()).toBe("unit-ward3");

    uiState.hoveredCardUnitId = null;
    await tick();
    expect(readLabelUnitAttribute()).toBe("unit-exact");
  });
});

describe("flag-guarded camera controls", () => {
  test("with the zoom flag on, the zoom buttons render with their localized names and flag markers and step the camera one step per click", async () => {
    vi.stubGlobal("__FLAG_W1_MAP_ZOOM__", true);
    try {
      const created = await mountedMapWithResolvedUnits([unitInWard7]);
      // Arrange the camera readout the zoom steps chain from.
      created.currentZoom = LOCALE_MAP_ZOOM;

      const zoomInButton = screen.getByRole("button", { name: m.map_zoom_in() });
      const zoomOutButton = screen.getByRole("button", { name: m.map_zoom_out() });
      expect(zoomInButton).toHaveAttribute("data-flag", "w1-map-zoom");
      expect(zoomOutButton).toHaveAttribute("data-flag", "w1-map-zoom");

      await userEvent.click(zoomInButton);
      await tick();
      expect(created.zoomToLog).toEqual([LOCALE_MAP_ZOOM + ZOOM_STEP]);

      await userEvent.click(zoomOutButton);
      await tick();
      expect(created.zoomToLog).toEqual([LOCALE_MAP_ZOOM + ZOOM_STEP, LOCALE_MAP_ZOOM]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("with the zoom flag off, no zoom control renders", async () => {
    vi.stubGlobal("__FLAG_W1_MAP_ZOOM__", false);
    vi.stubGlobal("__DEV_SERVER__", false);
    try {
      await mountedMapWithResolvedUnits([unitInWard7]);

      expect(screen.queryByRole("button", { name: m.map_zoom_in() })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: m.map_zoom_out() })).not.toBeInTheDocument();
      expect(document.querySelector('[data-flag="w1-map-zoom"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("with the recenter flag on, the recenter button renders with its localized name and flag marker and flies the camera back to the locale view", async () => {
    vi.stubGlobal("__FLAG_W2_RECENTER__", true);
    try {
      const created = await mountedMapWithResolvedUnits([unitInWard7]);

      const recenterButton = screen.getByRole("button", { name: m.map_recenter() });
      expect(recenterButton).toHaveAttribute("data-flag", "w2-recenter");

      await userEvent.click(recenterButton);
      await tick();

      expect(created.flyToLog.at(-1)).toEqual({
        center: [LOCALE_MAP_CENTER.lng, LOCALE_MAP_CENTER.lat],
        zoom: LOCALE_MAP_ZOOM,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("with the recenter flag off, no recenter control renders", async () => {
    vi.stubGlobal("__FLAG_W2_RECENTER__", false);
    vi.stubGlobal("__DEV_SERVER__", false);
    try {
      await mountedMapWithResolvedUnits([unitInWard7]);

      expect(screen.queryByRole("button", { name: m.map_recenter() })).not.toBeInTheDocument();
      expect(document.querySelector('[data-flag="w2-recenter"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("stale pin-hover clearing", () => {
  let listPane: HTMLElement;
  beforeEach(() => {
    // card clicks must bubble through the page's `.list-pane` chrome for
    // the map's off-map click dismissal to keep them alive
    listPane = chromeStub("list-pane");
  });

  test("after a canvas pin click and selecting another unit's card, hovering a third card and unhovering it returns the label to the selected unit", async () => {
    const unitC = aUnitCard().withId("unit-ward5").inWard(5).build();
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3, unitC]);
    // The real card call sites share the singleton uiState with the map.
    render(UnitCard, { props: { card: unitInWard3 }, target: listPane });
    render(UnitCard, { props: { card: unitC }, target: listPane });

    // Canvas pin A clicked: the pin hover id carries unit A.
    created.clickPin("unit-exact");
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");

    // Card B is selected through the real card call site (its button click).
    await userEvent.click(cardButtonFor(unitInWard3.id));
    await tick();
    expect(uiState.selectedUnitId).toBe("unit-ward3");
    expect(uiState.hoveredPinUnitId).toBeNull();

    // Hovering card C moves the label to C…
    cardButtonFor(unitC.id).dispatchEvent(new MouseEvent("pointerenter"));
    await tick();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(unitC.id));

    // …and unhovering returns the label to the selected unit B — never to A.
    cardButtonFor(unitC.id).dispatchEvent(new MouseEvent("pointerleave"));
    await tick();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(unitInWard3.id));
    expect(lastFilterFor(created, "units-pins-label")).not.toEqual(
      pinLabelLayerFilter(unitInWard7.id),
    );
  });

  test("clicking a card clears a stale canvas-pin hover id while selecting that unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    render(UnitCard, { props: { card: unitInWard3 }, target: listPane });

    created.clickPin("unit-exact");
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");

    await userEvent.click(cardButtonFor(unitInWard3.id));
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBe("unit-ward3");
  });

  test("activating a card with the keyboard clears a stale canvas-pin hover id while selecting that unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);
    render(UnitCard, { props: { card: unitInWard3 }, target: listPane });

    created.clickPin("unit-exact");
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");

    // Enter on the focused card button fires the same click handler the
    // pointer path uses — the keyboard activation must clear the hover too.
    cardButtonFor(unitInWard3.id).focus();
    await userEvent.keyboard("{Enter}");
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBe("unit-ward3");
  });

  test("activating a unit's keyboard pin button clears a stale canvas-pin hover id while selecting that unit", async () => {
    const created = await mountedMapWithResolvedUnits([unitInWard7, unitInWard3]);

    created.clickPin("unit-exact");
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");

    // The sr pin button for unit B is a keyboard activation path, not a
    // canvas pin hit: it must not leave a pin hover id behind.
    const pinButtons = document.querySelectorAll('[data-testid="map-pin-list"] button');
    (pinButtons[1] as HTMLButtonElement).click();
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBe("unit-ward3");
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
  });
});

describe("canvas pin hover intent delay", () => {
  /**
   * Mounts the map and the detail slide-over over a resolved store: the
   * hover proofs assert both the map-side label filters and that no detail
   * selection state or panel opens from a hover alone.
   */
  async function mountedMapWithDetail(units: unknown[]) {
    store = freshStore(units);
    await store.initialize();
    render(MapView, { props: { store } });
    render(DetailSlideOver, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    await tick();
    return created;
  }

  test("resting the pointer on a pin past the intent delay labels that pin without selecting it or opening the detail", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    // A generous advance: far past any tens-of-milliseconds intent delay.
    vi.useFakeTimers();
    try {
      created.firePinHover("unit-ward3");
      vi.advanceTimersByTime(250);
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-ward3");
    expect(uiState.selectedUnitId).toBeNull();
    expect(uiState.detailTriggerElement).toBeNull();
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    // A hover never moves the camera — selection owns the flyTo path.
    expect(created.flyToLog).toEqual([]);
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-ward3"),
    );
  });

  test("before the intent delay elapses the resting pin stays unlabeled", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    vi.useFakeTimers();
    try {
      created.firePinHover("unit-ward3");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS - 1);
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
    // No identity change has happened, so the no-match state is the filters
    // the layers ATTACHED with — read from the stored layers, not from a
    // setFilter log entry that does not exist yet.
    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter(null));
    const highlightLayer = created.layers.find((layer) => layer.id === "units-pins-highlight");
    expect(highlightLayer?.filter).toEqual(highlightLayerFilter(null));
  });

  test("sweeping across a pin without resting never labels it, and a later rest labels only the rested pin", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    vi.useFakeTimers();
    try {
      // The pointer enters a pin and moves on before the intent delay
      // elapses; the leave must cancel the pending enter outright.
      created.firePinHover("unit-exact");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS - 1);
      created.firePinLeave();
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS * 2);
      await tick();
      expect(uiState.hoveredPinUnitId).toBeNull();
      const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
      expect(labelLayer?.filter).toEqual(pinLabelLayerFilter(null));

      // Resting on another pin AFTER the sweep: only that pin's label lights
      // — the canceled sweep timer must not fire its own unit underneath.
      created.firePinHover("unit-ward3");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS);
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-ward3");
    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("crossing from one pin onto an overlapping pin without leaving the layer re-arms the intent: the label lands on the pin now under the pointer, never the pin crossed off", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    vi.useFakeTimers();
    try {
      // The pointer enters pin A and, still inside the layer (no
      // `mouseleave` fires between features of one layer), crosses onto the
      // overlapping pin B: layer-scoped travel arrives as `mousemove`, and
      // B's intent timer replaces A's pending one.
      created.firePinHover("unit-exact");
      vi.advanceTimersByTime(10);
      created.firePinMove("unit-ward3");
      // A's original deadline passes with the pointer resting on B: the
      // crossed-off pin never labels.
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS - 10);
      expect(uiState.hoveredPinUnitId).toBeNull();

      // B's own intent elapses — only then does the label land on B.
      vi.advanceTimersByTime(10);
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-ward3");
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
    expect(lastFilterFor(created, "units-pins-label")).not.toEqual(
      pinLabelLayerFilter("unit-exact"),
    );
  });

  test("a live wrong label corrects: after the first pin labeled, resting on a second pin switches the label to that pin once its own intent elapses", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    vi.useFakeTimers();
    try {
      created.firePinHover("unit-exact");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS);
      created.firePinMove("unit-ward3");
      // The already-live label keeps showing until the new intent elapses —
      // no flicker to empty and no immediate switch mid-travel.
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS - 1);
      expect(uiState.hoveredPinUnitId).toBe("unit-exact");

      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-ward3");
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-ward3"));
  });

  test("same-id mousemove traffic over an already-armed pin never restarts the intent timer", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    vi.useFakeTimers();
    try {
      created.firePinHover("unit-exact");
      vi.advanceTimersByTime(20);
      // Mousemove jitter over the SAME pin must not push the deadline out:
      // the original arming still fires exactly on time.
      created.firePinMove("unit-exact");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS - 20);
      expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-exact"));
  });

  test("leaving a labeled pin clears the hover id: an open selection keeps its label, no selection goes no-match", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    // Case A: the pin was CLICKED (hover id and selection both carry the
    // unit, detail open), then the pointer moves off the pin. The leave
    // clears the hover id; the label falls back to the still-open selection
    // — the same unit stays highlighted and labeled.
    created.clickPin("unit-exact");
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    created.firePinLeave();
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-exact"));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(
      highlightLayerFilter("unit-exact"),
    );

    // Case B: a pure hover label (delay elapsed, no selection anywhere), then
    // the pointer leaves. Nothing else holds the identity: the label goes to
    // the explicit no-match. Case A's selection is cleared first so nothing
    // stands behind the hover.
    uiState.selectedUnitId = null;
    await tick();
    vi.useFakeTimers();
    try {
      created.firePinHover("unit-ward3");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS);
    } finally {
      vi.useRealTimers();
    }
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-ward3");

    created.firePinLeave();
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBeNull();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(highlightLayerFilter(null));
  });

  test("clicking a hovered pin selects and opens the detail exactly like the bare pin click path", async () => {
    const created = await mountedMapWithDetail([unitInWard7, unitInWard3]);

    // The pointer rests on the pin past the intent delay first.
    vi.useFakeTimers();
    try {
      created.firePinHover("unit-exact");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS);
    } finally {
      vi.useRealTimers();
    }
    await tick();
    expect(uiState.hoveredPinUnitId).toBe("unit-exact");

    // The click on that hovered pin follows the same layer-scoped click
    // handler as ever: hover id and selection both carry the unit, the
    // detail opens, and the camera flies to the pin.
    created.clickPin("unit-exact");
    await tick();

    expect(uiState.hoveredPinUnitId).toBe("unit-exact");
    expect(uiState.selectedUnitId).toBe("unit-exact");
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(uiState.detailTriggerElement).toBe(
      document.querySelector('[data-testid="map-pin-list"] button[data-unit-id="unit-exact"]'),
    );
    expect(created.flyToLog.at(-1)).toEqual({
      center: pinCoordinatesFor(unitInWard7),
      zoom: CARD_FOCUS_ZOOM,
    });
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter("unit-exact"));
  });

  test("unmounting while an enter intent is still pending leaves no post-unmount hover write", async () => {
    store = freshStore([unitInWard7]);
    await store.initialize();
    const mounted = render(MapView, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    await tick();

    // The pointer enters a pin and the component unmounts BEFORE the intent
    // delay elapses: the pending timer must die with the map, never fire its
    // write into the shared ui state afterwards.
    vi.useFakeTimers();
    try {
      created.firePinHover("unit-exact");
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS - 1);
      mounted.unmount();
      vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS * 2);
    } finally {
      vi.useRealTimers();
    }
    await tick();

    expect(uiState.hoveredPinUnitId).toBeNull();
  });
});

describe("detail close returns focus to the opening control", () => {
  /**
   * Mounts the map, the card list, and the detail slide-over together over a
   * resolved store: the close-path focus proofs need the real selection call
   * sites (card button, keyboard pin button, canvas pin) feeding the
   * slide-over that closes, all sharing the uiState singleton.
   */
  async function mountedMapCardsAndDetail(units: unknown[]) {
    store = freshStore(units);
    await store.initialize();
    render(MapView, { props: { store } });
    const listPane = chromeStub("list-pane");
    for (const unit of store.units ?? []) {
      render(UnitCard, { props: { card: unit }, target: listPane });
    }
    render(DetailSlideOver, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    await tick();
    return created;
  }

  /** The screen-reader pin button is the unit's pin control in the a11y tree. */
  function srPinButtonFor(unitId: string): HTMLButtonElement {
    const button = document.querySelector(
      `[data-testid="map-pin-list"] button[data-unit-id="${unitId}"]`,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`sr pin button for unit ${unitId} not found`);
    }
    return button;
  }

  function pressEscape(): void {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }

  test("closing the detail from its close button returns focus to the card button that opened it", async () => {
    await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const opener = cardButtonFor(unitInWard7.id);
    await userEvent.click(opener);
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    // the open panel grabs focus, so the close edge must actively restore
    expect(document.activeElement).not.toBe(opener);

    await userEvent.click(screen.getByRole("button", { name: m.detail_close() }));
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  test("closing the detail with Escape returns focus to the card button that opened it", async () => {
    await mountedMapCardsAndDetail([unitInWard7]);
    const opener = cardButtonFor(unitInWard7.id);
    await userEvent.click(opener);
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    pressEscape();
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  test("closing the detail by clicking empty canvas returns focus to the card button that opened it", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const opener = cardButtonFor(unitInWard7.id);
    await userEvent.click(opener);
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    // focus has moved on while the detail is open, so a passing proof must be
    // active restoration — never an inherited focus the opener never lost
    cardButtonFor(unitInWard3.id).focus();
    await tick();
    expect(document.activeElement).toBe(cardButtonFor(unitInWard3.id));

    created.clickCanvas(12, 34); // the hit-test stub reports no pin under the point
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  test("closing the detail returns focus to the keyboard pin button that opened it", async () => {
    await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const opener = srPinButtonFor(unitInWard3.id);
    opener.focus();
    opener.click();
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(opener);

    pressEscape();
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  test("closing the detail opened by a canvas pin click returns focus to that unit's screen-reader pin button", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    created.clickPin("unit-exact");
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    pressEscape();
    await tick();

    // a canvas pin has no DOM control of its own; the unit's pin control in
    // the a11y tree is its screen-reader pin button
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(srPinButtonFor(unitInWard7.id));
  });

  test("closing the detail leaves focus where the browser put it when the opening control has left the DOM", async () => {
    await mountedMapCardsAndDetail([unitInWard7]);
    const opener = cardButtonFor(unitInWard7.id);
    await userEvent.click(opener);
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    // the selection call site captured the opener as the close target
    expect(uiState.detailTriggerElement).toBe(opener);

    // the card list re-rendered without this unit: the opener is detached
    opener.remove();

    pressEscape();
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body); // no forced move, no throw
    expect(uiState.detailTriggerElement).toBeNull(); // the stale trigger is dropped
  });

  test("closing the detail returns focus to the opener card without re-lighting its label", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const opener = cardButtonFor(unitInWard7.id);
    await userEvent.click(opener);
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: m.detail_close() }));
    await tick();

    // focus lands back on the opener card…
    expect(document.activeElement).toBe(opener);
    // …but the card's focus handler must not re-light the hover state the
    // close just dismissed: no card hover and no address label survive close
    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
  });

  test("closing the detail returns focus to the opener pin button without re-lighting its label", async () => {
    const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const opener = srPinButtonFor(unitInWard3.id);
    opener.focus();
    opener.click();
    await tick();
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(opener);

    pressEscape();
    await tick();

    // focus lands back on the pin button…
    expect(document.activeElement).toBe(opener);
    // …and the close's dismissal still wins over the button's focus handler:
    // no hover state and no address label survive the keyboard close
    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
  });

  test("switching selections while the detail stays open retargets focus return to the latest opening control", async () => {
    await mountedMapCardsAndDetail([unitInWard7, unitInWard3]);
    const openerA = cardButtonFor(unitInWard7.id);
    const openerB = cardButtonFor(unitInWard3.id);
    await userEvent.click(openerA);
    await tick();
    await userEvent.click(openerB);
    await tick();
    // A → B keeps the panel open: no close edge fired between the selections
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
    // the keyboard user has moved into the open panel, so closing must
    // actively restore focus — inheriting openerB's focus would prove nothing
    screen.getByRole("button", { name: m.detail_close() }).focus();
    await tick();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: m.detail_close() }));

    pressEscape();
    await tick();

    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openerB);
  });
});

describe("dismissal state machine (one empty-canvas click-off from every reachable state)", () => {
  const unitWard5 = aUnitCard()
    .withId("unit-ward5")
    .inWard(5)
    .withCoordinates(38.9, -77.03)
    .build();

  /**
   * Mounts the map, every unit's card, and the detail slide-over together:
   * the dismissal proofs need the real selection call sites (canvas pin,
   * card button, keyboard pin button) feeding the slide-over that closes,
   * all sharing the uiState singleton. The canvas-pin hover row reaches a
   * bare live hover without a selection through the intent-delay path (a
   * pointer resting on a pin that was never clicked); every other row starts
   * from a click/keyboard lineage.
   */
  async function mountedMapCardsAndDetail(units: unknown[]) {
    store = freshStore(units);
    await store.initialize();
    render(MapView, { props: { store } });
    const listPane = chromeStub("list-pane");
    for (const unit of store.units ?? []) {
      render(UnitCard, { props: { card: unit }, target: listPane });
    }
    render(DetailSlideOver, { props: { store } });
    await tick();
    const created = h.instances.at(0)!;
    created.styleLoaded = true;
    created.fireLoad();
    await tick();
    return created;
  }

  /** The screen-reader pin button is the unit's pin control in the a11y tree. */
  function srPinButtonFor(unitId: string): HTMLButtonElement {
    const button = document.querySelector(
      `[data-testid="map-pin-list"] button[data-unit-id="${unitId}"]`,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`sr pin button for unit ${unitId} not found`);
    }
    return button;
  }

  type MountedMap = Awaited<ReturnType<typeof mountedMapCardsAndDetail>>;

  /**
   * The one all-dismissed terminal state: no hover, no selection, no detail
   * panel, no address label, no highlight — and nothing left over (the focus
   * return trigger is dropped, and one more settle proves the restore cannot
   * re-light a hover or a label).
   */
  async function expectAllDismissedTerminalState(created: MountedMap): Promise<void> {
    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.selectedUnitId).toBeNull();
    expect(uiState.detailTriggerElement).toBeNull();
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(highlightLayerFilter(null));
    // the stored label layer mirrors the latest call, like the real map
    const labelLayer = created.layers.find((layer) => layer.id === "units-pins-label");
    expect(labelLayer?.filter).toEqual(pinLabelLayerFilter(null));
    // the focus restore must not re-light anything: one more settle keeps the
    // cleared hover and the no-match filters in place
    await tick();
    expect(uiState.hoveredCardUnitId).toBeNull();
    expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
    expect(lastFilterFor(created, "units-pins-highlight")).toEqual(highlightLayerFilter(null));
  }

  /**
   * Every reachable interaction state the dismissal must converge from,
   * each reached through the real handlers (mock map click dispatch, DOM
   * clicks, hovers, focus) — never raw uiState writes — and asserted to be
   * the state it claims before the click-off acts.
   */
  const dismissalRows: Array<{
    initialState: string;
    arrange: (created: MountedMap) => Promise<void>;
  }> = [
    {
      initialState: "a card hover label on unit-exact",
      arrange: async (created) => {
        cardButtonFor(unitInWard7.id).dispatchEvent(new MouseEvent("pointerenter"));
        await tick();
        expect(uiState.hoveredCardUnitId).toBe(unitInWard7.id);
        expect(uiState.selectedUnitId).toBeNull();
        expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitInWard7.id),
        );
      },
    },
    {
      initialState: "a keyboard focus label on unit-exact",
      arrange: async (created) => {
        cardButtonFor(unitInWard7.id).focus();
        await tick();
        expect(uiState.hoveredCardUnitId).toBe(unitInWard7.id);
        expect(uiState.selectedUnitId).toBeNull();
        expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitInWard7.id),
        );
      },
    },
    {
      initialState: "a canvas pin click with the detail open on unit-exact",
      arrange: async (created) => {
        created.clickPin(unitInWard7.id);
        await tick();
        expect(uiState.hoveredPinUnitId).toBe(unitInWard7.id);
        expect(uiState.selectedUnitId).toBe(unitInWard7.id);
        expect(uiState.detailTriggerElement).toBe(srPinButtonFor(unitInWard7.id));
        expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitInWard7.id),
        );
      },
    },
    {
      initialState: "a card click with the detail open on unit-ward3",
      arrange: async (created) => {
        cardButtonFor(unitInWard3.id).click();
        await tick();
        expect(uiState.selectedUnitId).toBe(unitInWard3.id);
        expect(uiState.hoveredCardUnitId).toBeNull();
        expect(uiState.detailTriggerElement).toBe(cardButtonFor(unitInWard3.id));
        expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitInWard3.id),
        );
      },
    },
    {
      initialState: "a keyboard pin activation with the detail open on unit-ward5",
      arrange: async (created) => {
        const pinButton = srPinButtonFor(unitWard5.id);
        pinButton.focus();
        pinButton.click();
        await tick();
        expect(uiState.selectedUnitId).toBe(unitWard5.id);
        expect(uiState.hoveredPinUnitId).toBeNull();
        // the freshly opened panel grabbed focus, so the pin button's blur
        // cleared its hover slot: the label rides the selection fallback
        expect(uiState.hoveredCardUnitId).toBeNull();
        expect(uiState.detailTriggerElement).toBe(pinButton);
        expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitWard5.id),
        );
      },
    },
    {
      initialState: "a canvas pin click on unit-exact followed by selecting unit-ward3's card",
      arrange: async (created) => {
        created.clickPin(unitInWard7.id);
        await tick();
        cardButtonFor(unitInWard3.id).click();
        await tick();
        expect(uiState.selectedUnitId).toBe(unitInWard3.id);
        // the stale canvas-pin hover id did not survive the card selection
        expect(uiState.hoveredPinUnitId).toBeNull();
        expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitInWard3.id),
        );
      },
    },
    {
      initialState: "a card hover on unit-ward5 over the open unit-ward3 selection",
      arrange: async (created) => {
        cardButtonFor(unitInWard3.id).click();
        await tick();
        cardButtonFor(unitWard5.id).dispatchEvent(new MouseEvent("pointerenter"));
        await tick();
        // the live hover owns the label while the selection stays open
        expect(uiState.hoveredCardUnitId).toBe(unitWard5.id);
        expect(uiState.selectedUnitId).toBe(unitInWard3.id);
        expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitWard5.id),
        );
      },
    },
    {
      initialState: "a live canvas pin hover (the enter intent delay elapsed)",
      arrange: async (created) => {
        vi.useFakeTimers();
        try {
          created.firePinHover(unitInWard7.id);
          vi.advanceTimersByTime(PIN_HOVER_INTENT_DELAY_MS);
        } finally {
          vi.useRealTimers();
        }
        await tick();
        expect(uiState.hoveredPinUnitId).toBe(unitInWard7.id);
        expect(uiState.selectedUnitId).toBeNull();
        expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
        expect(lastFilterFor(created, "units-pins-label")).toEqual(
          pinLabelLayerFilter(unitInWard7.id),
        );
      },
    },
    {
      initialState:
        "the focus-restored state after closing unit-ward3's detail with the close button",
      arrange: async (created) => {
        cardButtonFor(unitInWard3.id).click();
        await tick();
        screen.getByRole("button", { name: m.detail_close() }).click();
        await tick();
        expect(uiState.hoveredCardUnitId).toBeNull();
        expect(uiState.hoveredPinUnitId).toBeNull();
        expect(uiState.selectedUnitId).toBeNull();
        expect(uiState.detailTriggerElement).toBeNull();
        expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
        expect(document.activeElement).toBe(cardButtonFor(unitInWard3.id));
        expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
      },
    },
    {
      initialState: "the focus-restored state after closing unit-ward5's detail with Escape",
      arrange: async (created) => {
        const pinButton = srPinButtonFor(unitWard5.id);
        pinButton.focus();
        pinButton.click();
        await tick();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await tick();
        expect(uiState.hoveredCardUnitId).toBeNull();
        expect(uiState.hoveredPinUnitId).toBeNull();
        expect(uiState.selectedUnitId).toBeNull();
        expect(uiState.detailTriggerElement).toBeNull();
        expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
        expect(document.activeElement).toBe(pinButton);
        expect(lastFilterFor(created, "units-pins-label")).toEqual(pinLabelLayerFilter(null));
      },
    },
  ];

  for (const row of dismissalRows) {
    test(`one empty-canvas click-off from ${row.initialState} converges to the all-dismissed state`, async () => {
      const created = await mountedMapCardsAndDetail([unitInWard7, unitInWard3, unitWard5]);
      await row.arrange(created);

      // the single action under proof: one map-wide canvas click that lands
      // on no pin (the hit-test stub reports no rendered features under the
      // click point)
      created.queryRenderedFeaturesResult = [];
      created.clickCanvas(12, 34);
      await tick();

      await expectAllDismissedTerminalState(created);
    });
  }
});
