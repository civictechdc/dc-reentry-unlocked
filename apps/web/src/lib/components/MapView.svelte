<script lang="ts">
  import { untrack } from "svelte";
  import type { AddLayerObject, FilterSpecification, GeoJSONSource } from "maplibre-gl";
  import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
  import { m } from "#lib/paraglide/messages.js";
  // Bundler-bundled MapLibre worker: in a bundler build (Vite), the library
  // cannot auto-detect the worker URL from `import.meta.url` — without this
  // one-time wiring the production build ships no worker and no tiles render.
  import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
  setWorkerUrl(mapWorkerUrl);
  import {
    basePinLayerPaint,
    CARD_FOCUS_ZOOM,
    createMapStyle,
    DC_MAP_CENTER,
    DC_MAP_ZOOM,
    highlightLayerFilter,
    highlightPinLayerPaint,
    pinCoordinatesFor,
    PIN_SOURCE,
    pinLabelLayerDefinition,
    pinLabelLayerFilter,
    unitsToFeatureCollection,
  } from "#lib/map/map-config.ts";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /**
   * MapLibre thin wrapper: GeoJSON circle-layer pins with a shared
   * address-label layer (no per-pin DOM markers), OSM raster tiles with the
   * required attribution, and pin↔card cross-highlighting in both directions.
   */
  let container: HTMLElement | undefined = $state();
  let map: MapLibreMap | null = null;
  let highlightedUnitId = $state<string | null>(null);
  // Camera observability (e2e/debug hook, not user-facing): center serialized
  // as `"<lng>,<lat>"`, zoom as a plain number string; refreshed on `moveend`.
  let cameraCenterAttribute = $state(`${DC_MAP_CENTER.lng},${DC_MAP_CENTER.lat}`);
  let cameraZoomAttribute = $state(String(DC_MAP_ZOOM));

  $effect(() => {
    if (!container || map) return;
    // Mount-time camera: a selection pre-existing at mount (the map can be
    // unmounted while the list tab is active) opens already focused on that
    // unit's pin. When the selected unit is no longer in the current result
    // set, the camera intentionally falls back to the DC default view — no
    // pin is placed, so there is nothing to focus. Read untracked like the
    // units snapshot below — the create effect must depend on the container
    // only.
    const focusedUnit = untrack(() => {
      const selectedUnitId = uiState.selectedUnitId;
      return (store.units ?? []).find((unit) => unit.id === selectedUnitId) ?? null;
    });
    const initialCenter: [number, number] = focusedUnit
      ? pinCoordinatesFor(focusedUnit)
      : [DC_MAP_CENTER.lng, DC_MAP_CENTER.lat];
    const initialZoom = focusedUnit ? CARD_FOCUS_ZOOM : DC_MAP_ZOOM;
    map = new MapLibreMap({
      container,
      style: createMapStyle(),
      center: initialCenter,
      zoom: initialZoom,
    });
    cameraCenterAttribute = `${initialCenter[0]},${initialCenter[1]}`;
    cameraZoomAttribute = String(initialZoom);
    map.on("moveend", () => {
      if (!map) return;
      const center = map.getCenter();
      cameraCenterAttribute = `${center.lng},${center.lat}`;
      cameraZoomAttribute = String(map.getZoom());
    });
    map.on("load", () => {
      if (!map) return;
      // The initial source payload is untracked on purpose: the map-create
      // effect must depend on the container only — a `store.units` change
      // re-renders pins through the dedicated update effect instead of
      // rebuilding the whole GL map.
      const initialUnits = untrack(() => store.units ?? []);
      map.addSource(PIN_SOURCE, {
        type: "geojson",
        data: unitsToFeatureCollection(initialUnits, highlightedUnitId),
      });
      map.addLayer({
        id: "units-pins-base",
        type: "circle",
        source: PIN_SOURCE,
        paint: basePinLayerPaint(),
      } as AddLayerObject);
      map.addLayer({
        id: "units-pins-highlight",
        type: "circle",
        source: PIN_SOURCE,
        paint: highlightPinLayerPaint(),
        filter: highlightLayerFilter(highlightedUnitId) as FilterSpecification,
      } as AddLayerObject);
      // The address labels ride the same pin source, attached above both
      // circle layers so the text renders over the pins. The initial filter
      // is the identity live at attach time: the identity state above is
      // synced before `load` can fire, so a remount with the detail open
      // starts labeled on the selected unit instead of briefly unlabeled.
      map.addLayer(
        pinLabelLayerDefinition(pinLabelLayerFilter(highlightedUnitId)) as AddLayerObject,
      );
      map.on("click", "units-pins-base", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) {
          uiState.hoveredPinUnitId = id;
          uiState.selectedUnitId = id;
        }
      });
    });
    return () => {
      map?.remove();
      map = null;
    };
  });

  // Pins re-render from the same result set as the card list. Deliberately
  // NO highlight dependency here: hover/selection highlight is handled by
  // the highlight layer's setFilter — a pin re-render (setData) per hover
  // would churn the whole source for a paint-only change.
  //
  // The guard is SOURCE EXISTENCE, not the style's load state: isStyleLoaded()
  // flips back to false right after the load handler adds the source and
  // layers (pending source updates + tile settling) and re-dips while tiles
  // settle, so guarding on it silently dropped units changes with no replay.
  // setData on an existing source carries no style-loaded precondition (it
  // enqueues a coalesced worker update — the latest call wins), and while
  // the source does not exist yet the load handler attaches it with the
  // current units — so the latest units always reach the source.
  $effect(() => {
    const data = unitsToFeatureCollection(store.units ?? []);
    const source = map?.getSource(PIN_SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(data);
  });

  // ONE shared highlight identity drives both the highlight circle layer and
  // the address-label layer: card hover/focus wins while active (including
  // the keyboard pin-button focus path), the canvas-pin hover next, and the
  // selection persists as the fallback — with the detail open and no hover,
  // the selected unit stays highlighted and labeled until the detail closes.
  // Layer existence, not style-load state: setFilter on a not-yet-attached
  // layer throws, and the layers appear exactly when the load handler runs.
  $effect(() => {
    highlightedUnitId =
      uiState.hoveredCardUnitId ?? uiState.hoveredPinUnitId ?? uiState.selectedUnitId;
    if (map?.getLayer("units-pins-highlight")) {
      map.setFilter(
        "units-pins-highlight",
        highlightLayerFilter(highlightedUnitId) as FilterSpecification | null,
      );
    }
    if (map?.getLayer("units-pins-label")) {
      map.setFilter(
        "units-pins-label",
        pinLabelLayerFilter(highlightedUnitId) as FilterSpecification | null,
      );
    }
  });

  // Focus follows EVERY selection change (card clicks, keyboard card
  // activation, pin activation, canvas pin clicks): the camera flies to the
  // selected unit's pin at the card-focus zoom. The units lookup stays
  // untracked — only the selection drives this effect; a result-set change
  // re-renders pins but never moves the camera. The mount-time value is
  // skipped: the create effect above already opens the camera on a
  // pre-existing selection, so no redundant flyTo fires at mount.
  let selectionFocusPrimed = false;
  $effect(() => {
    const selectedUnitId = uiState.selectedUnitId;
    if (!selectionFocusPrimed) {
      selectionFocusPrimed = true;
      return;
    }
    const unit = untrack(() =>
      (store.units ?? []).find((candidate) => candidate.id === selectedUnitId),
    );
    if (!unit || !map) return;
    map.flyTo({ center: pinCoordinatesFor(unit), zoom: CARD_FOCUS_ZOOM });
  });
</script>

<!-- Camera observability (e2e/debug): center as `"<lng>,<lat>"`, zoom as a
     number string, refreshed on the map's `moveend`. -->
<section
  class="map-view"
  aria-label={m.map_region_label()}
  data-testid="map-view"
  data-map-center={cameraCenterAttribute}
  data-map-zoom={cameraZoomAttribute}
>
  <div class="map-canvas" bind:this={container}></div>
  <!-- Keyboard-reachable pin selection: every unit pin has a focusable button. -->
  <ul class="sr-pins" aria-label={m.map_region_label()} data-testid="map-pin-list">
    {#each store.units ?? [] as unit (unit.id)}
      <li>
        <button
          type="button"
          aria-label={m.map_select_pin({ address: unit.address })}
          onfocus={() => (uiState.hoveredCardUnitId = unit.id)}
          onblur={() => (uiState.hoveredCardUnitId = null)}
          onclick={() => {
            uiState.hoveredPinUnitId = unit.id;
            uiState.selectedUnitId = unit.id;
          }}
        >
          <span class="pin-label" aria-hidden="true">{unit.address}</span>
        </button>
      </li>
    {/each}
  </ul>
  <p class="map-legend">
    <strong>{m.map_legend_title()}</strong>
    <span class="legend-item">
      <span class="pin exact" aria-hidden="true"></span>
      {m.map_legend_exact()}
    </span>
  </p>
</section>

<style>
  .map-view {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    min-height: 0;
  }
  .sr-pins {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .sr-pins button:focus-visible {
    position: fixed;
    width: auto;
    height: auto;
    clip-path: none;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 60;
    padding: 0.5rem 1rem;
    background: var(--surface-raised);
    border: 2px solid var(--accent);
    font: inherit;
    color: var(--ink);
  }
  .pin-label {
    display: none;
  }
  .sr-pins button:focus-visible .pin-label {
    display: inline;
  }
  .map-canvas {
    min-height: 24rem;
    height: 100%;
  }
  .map-legend {
    margin: 0;
    padding: 0.5rem 1rem;
    background: var(--surface-raised);
    border-top: 1px solid var(--line);
    font-size: 0.875rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .pin {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    border: 2px solid var(--surface-raised);
  }
  .pin.exact {
    background: var(--pin-exact);
  }
</style>
