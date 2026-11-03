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
    createMapStyle,
    DC_MAP_CENTER,
    DC_MAP_ZOOM,
    highlightLayerFilter,
    highlightPinLayerPaint,
    PIN_SOURCE,
    unitsToFeatureCollection,
  } from "#lib/map/map-config.ts";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /**
   * MapLibre thin wrapper: GeoJSON circle-layer pins only (no per-pin DOM
   * markers), OSM raster tiles with the required attribution, and pin↔card
   * cross-highlighting in both directions.
   */
  let container: HTMLElement | undefined = $state();
  let map: MapLibreMap | null = null;
  let highlightedUnitId = $state<string | null>(null);

  $effect(() => {
    if (!container || map) return;
    map = new MapLibreMap({
      container,
      style: createMapStyle(),
      center: [DC_MAP_CENTER.lng, DC_MAP_CENTER.lat],
      zoom: DC_MAP_ZOOM,
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

  // The highlight filter follows the card hover/focus and pin selection.
  // Layer existence, not style-load state: setFilter on a not-yet-attached
  // layer throws, and the layer appears exactly when the load handler runs.
  $effect(() => {
    highlightedUnitId = uiState.hoveredCardUnitId ?? uiState.hoveredPinUnitId;
    if (map?.getLayer("units-pins-highlight")) {
      map.setFilter(
        "units-pins-highlight",
        highlightLayerFilter(highlightedUnitId) as FilterSpecification | null,
      );
    }
  });
</script>

<section class="map-view" aria-label={m.map_region_label()} data-testid="map-view">
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
