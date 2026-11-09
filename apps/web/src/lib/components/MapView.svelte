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
  import { hasFlagOverride } from "#lib/flags/index.ts";
  import {
    basePinLayerPaint,
    CARD_FOCUS_ZOOM,
    createMapStyle,
    highlightLayerFilter,
    highlightPinLayerPaint,
    LOCALE_MAP_CENTER,
    LOCALE_MAP_ZOOM,
    pinCoordinatesFor,
    PIN_SOURCE,
    PIN_LABEL_BUBBLE_IMAGE_ID,
    pinLabelBubbleImage,
    pinLabelBubbleImageMetadata,
    pinLabelLayerDefinition,
    pinLabelLayerFilter,
    PIN_HOVER_INTENT_DELAY_MS,
    recenterOnLocale,
    unitsToFeatureCollection,
    zoomIn,
    zoomOut,
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
  let pinList: HTMLElement | undefined = $state();
  let map: MapLibreMap | null = null;
  let highlightedUnitId = $state<string | null>(null);
  // Camera observability (e2e/debug hook, not user-facing): center serialized
  // as `"<lng>,<lat>"`, zoom as a plain number string; refreshed on `moveend`.
  let cameraCenterAttribute = $state(`${LOCALE_MAP_CENTER.lng},${LOCALE_MAP_CENTER.lat}`);
  let cameraZoomAttribute = $state(String(LOCALE_MAP_ZOOM));

  $effect(() => {
    if (!container || map) return;
    // Mount-time camera: a selection pre-existing at mount (the map can be
    // unmounted while the list tab is active) opens already focused on that
    // unit's pin. When the selected unit is no longer in the current result
    // set, the camera intentionally falls back to the locale default view —
    // no pin is placed, so there is nothing to focus. Read untracked like the
    // units snapshot below — the create effect must depend on the container
    // only.
    const focusedUnit = untrack(() => {
      const selectedUnitId = uiState.selectedUnitId;
      return (store.units ?? []).find((unit) => unit.id === selectedUnitId) ?? null;
    });
    const initialCenter: [number, number] = focusedUnit
      ? pinCoordinatesFor(focusedUnit)
      : [LOCALE_MAP_CENTER.lng, LOCALE_MAP_CENTER.lat];
    const initialZoom = focusedUnit ? CARD_FOCUS_ZOOM : LOCALE_MAP_ZOOM;
    // The pending enter-intent timer for the map created below: effect-local
    // so each map instance owns exactly one slot and the teardown closes over
    // it (a pending timer must never outlive the map that registered it).
    // The sibling id records WHICH pin the slot is armed (or last fired) for
    // — the layer-scoped mousemove correction below compares against it; it
    // never needs clearing beyond the timer itself (the whole closure dies
    // with the map).
    let pinHoverIntentTimer: number | null = null;
    let pinHoverIntentTargetId: string | null = null;
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
    // Click-off dismissal: a canvas click that lands on NO pin clears the
    // card hover, the pin hover, and the selection (closing the detail and
    // filtering the label layer back to the explicit no-match). A pin hit
    // leaves the state alone — the layer-scoped click handler inside `load`
    // owns pin clicks, and clicks pass through the label bubble to the pin
    // beneath it. Panning safety needs no drag guard here: MapLibre
    // natively suppresses the `click` that would trail a completed drag, so
    // dismissal stays strictly click-bound.
    map.on("click", (event) => {
      if (!map) return;
      // Before `load` attaches the pin layers, a click is inert: the
      // hit-test layer does not exist (querying it would be a maplibre
      // error), and live selection state must not be dismissed by clicks
      // the pin layers could not have participated in.
      if (!map.getLayer("units-pins-base")) return;
      const pinHits = map.queryRenderedFeatures(event.point, {
        layers: ["units-pins-base"],
      });
      if (pinHits.length > 0) return;
      uiState.hoveredCardUnitId = null;
      uiState.hoveredPinUnitId = null;
      uiState.selectedUnitId = null;
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
      // circle layers so bubble and text render over the pins. The bubble
      // bitmap registers first — a symbol layer referencing an unregistered
      // image draws nothing — with its stretch/content metadata passed
      // through the PUBLIC addImage's options argument: the runtime reads
      // pixelRatio/sdf/stretchX/stretchY/content from the options only and
      // takes just {width, height, data} from the image object, so metadata
      // inside the image object would never reach the renderer. The initial
      // filter is the identity live at attach time: the identity state above
      // is synced before `load` can fire, so a remount with the detail open
      // starts labeled on the selected unit instead of briefly unlabeled.
      map.addImage(PIN_LABEL_BUBBLE_IMAGE_ID, pinLabelBubbleImage(), pinLabelBubbleImageMetadata());
      map.addLayer(
        pinLabelLayerDefinition(pinLabelLayerFilter(highlightedUnitId)) as AddLayerObject,
      );
      map.on("click", "units-pins-base", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) {
          uiState.hoveredPinUnitId = id;
          // A canvas pin has no DOM control of its own: focus return maps to
          // the unit's screen-reader pin button, the unit's pin control in
          // the accessibility tree.
          uiState.detailTriggerElement =
            pinList?.querySelector<HTMLButtonElement>(`button[data-unit-id="${CSS.escape(id)}"]`) ??
            null;
          uiState.selectedUnitId = id;
        }
      });
      // Pointer hover on a canvas pin: the pointer entering the base pin
      // layer carries the queried feature under it, so the unit id is read
      // from `features[0]`. The sibling `mouseleave` event has NO `features`
      // — the leave path knows what to clear without consulting the event.
      // The id lights only after a short intent delay, so sweeping the
      // pointer across pins never flickers a label under each one.
      //
      // Arming is shared by the enter path and the mousemove correction
      // below: cancel whatever is pending, then arm the full intent delay
      // for the given pin — the same delay applies to a correction of an
      // already-live label.
      const armPinHoverIntent = (id: string): void => {
        if (pinHoverIntentTimer !== null) window.clearTimeout(pinHoverIntentTimer);
        pinHoverIntentTargetId = id;
        pinHoverIntentTimer = window.setTimeout(() => {
          pinHoverIntentTimer = null;
          uiState.hoveredPinUnitId = id;
        }, PIN_HOVER_INTENT_DELAY_MS);
      };
      map.on("mouseenter", "units-pins-base", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (!id) return;
        armPinHoverIntent(id);
      });
      // Pin-to-pin travel inside the layer: MapLibre's layer-scoped
      // `mouseenter` does NOT re-fire when the pointer crosses between
      // features of the same layer, so the timer armed on the pin crossed
      // off would otherwise fire while the pointer rests on the next pin.
      // The layer-scoped `mousemove` (which DOES carry `features`, like the
      // enter event) re-checks the pin under the pointer and re-arms the
      // intent for a CHANGED id only — same-id traffic is a no-op, never a
      // timer restart. A label already live from the crossed-off pin stays
      // until the new intent elapses, then switches to the rested pin. A
      // features-less event is ignored: the leave handler owns clearing.
      map.on("mousemove", "units-pins-base", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (!id || id === pinHoverIntentTargetId) return;
        armPinHoverIntent(id);
      });
      map.on("mouseleave", "units-pins-base", () => {
        if (pinHoverIntentTimer !== null) {
          window.clearTimeout(pinHoverIntentTimer);
          pinHoverIntentTimer = null;
        }
        // Cleared unconditionally — safe by identity precedence: a hover id
        // that came from a pin click falls back to the still-open selection
        // (same unit), and with no selection the label goes no-match.
        uiState.hoveredPinUnitId = null;
      });
    });
    return () => {
      // The pending enter intent dies with the map that registered it: a
      // timer left running would write a hover id into the shared ui state
      // after unmount.
      if (pinHoverIntentTimer !== null) {
        window.clearTimeout(pinHoverIntentTimer);
        pinHoverIntentTimer = null;
      }
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

  // Off-map click dismissal: a bubble-phase `document` click that lands on
  // NONE of the keep-alive surfaces — the map pane (its empty-canvas
  // click-off owns in-map clicks), the desktop card list pane, the detail
  // slide-over, and the phone tab bar (tab switching preserves the
  // selection) — clears exactly what the canvas click-off clears: the card
  // hover, the pin hover, and the selection (closing the detail and
  // filtering the label layer to the explicit no-match). The focus-return
  // trigger is dropped BEFORE the selection so the detail's close edge
  // finds no live trigger and skips focus restoration — the control the
  // click just activated keeps its focus, instead of being yanked back to
  // the opener. Bubble phase, never capture: excluded surfaces must
  // receive their own clicks first.
  const OFF_MAP_CLICK_KEEP_ALIVE_SELECTOR = ".map-view, .list-pane, .detail, .mobile-bar";

  function onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest(OFF_MAP_CLICK_KEEP_ALIVE_SELECTOR)) {
      return;
    }
    uiState.detailTriggerElement = null;
    uiState.hoveredCardUnitId = null;
    uiState.hoveredPinUnitId = null;
    uiState.selectedUnitId = null;
  }
</script>

<!-- Document-level off-map click dismissal; lives and dies with the map's
     mount, exactly like the GL map itself. -->
<svelte:document onclick={onDocumentClick} />

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
  <!-- Flag-guarded camera controls (candidate walkthrough features): each
       control calls a map-config camera operation with the component's map
       instance — the control UI never touches the map directly. Placement is
       a candidate too; it settles in a dev trial. -->
  <div class="map-camera-controls">
    {#if __FLAG_W1_MAP_ZOOM__ || (__DEV_SERVER__ && hasFlagOverride("w1-map-zoom"))}
      <div class="map-zoom-controls">
        <button
          type="button"
          aria-label={m.map_zoom_in()}
          data-flag="w1-map-zoom"
          onclick={() => {
            if (map) zoomIn(map);
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          aria-label={m.map_zoom_out()}
          data-flag="w1-map-zoom"
          onclick={() => {
            if (map) zoomOut(map);
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>
    {/if}
    {#if __FLAG_W2_RECENTER__ || (__DEV_SERVER__ && hasFlagOverride("w2-recenter"))}
      <button
        type="button"
        class="map-recenter-control"
        aria-label={m.map_recenter()}
        data-flag="w2-recenter"
        onclick={() => {
          if (map) recenterOnLocale(map);
        }}
      >
        <span aria-hidden="true">⊕</span>
      </button>
    {/if}
  </div>
  <!-- Keyboard-reachable pin selection: every unit pin has a focusable button. -->
  <ul
    class="sr-pins"
    aria-label={m.map_region_label()}
    data-testid="map-pin-list"
    bind:this={pinList}
  >
    {#each store.units ?? [] as unit (unit.id)}
      <li>
        <button
          type="button"
          aria-label={m.map_select_pin({ address: unit.address })}
          data-unit-id={unit.id}
          onfocus={() => (uiState.hoveredCardUnitId = unit.id)}
          onblur={() => (uiState.hoveredCardUnitId = null)}
          onclick={(event) => {
            // The pin button is a keyboard activation path, not a canvas
            // pin hit: it selects the unit, clears any canvas-pin hover
            // id so the label falls back to this selection (never to a
            // stale pin hover from an earlier canvas pin click), and
            // remembers this button as the detail's focus-return target.
            uiState.hoveredPinUnitId = null;
            uiState.detailTriggerElement =
              event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
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
      {m.map_legend_unit()}
    </span>
  </p>
</section>

<style>
  .map-view {
    position: relative;
    display: grid;
    /* Shrinkable single column: MapLibre pins an inline pixel width on its
       canvas at mount — an implicit auto track would size to that stale
       width, and the map could never shrink with its pane again. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
    /* Framed pane: a small border follows the map pane wherever it renders
       (desktop capped map, phone square). Overflow clips the canvas into the
       rounded corners; fixed-position descendants (the sr-pin focus bubble)
       are not clipped by it. */
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    overflow: hidden;
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
  /* Ancestor clip-path subtree-clips EVERYTHING under it — including the
     focused pin button's position:fixed bubble — which would hide the bubble
     from paint and hit-testing entirely. Release the clip only while a pin
     is focused: the other buttons stay screen-hidden by the 1px overflow box,
     and the clip returns the moment focus leaves. */
  .sr-pins:has(button:focus-visible) {
    clip-path: none;
  }
  .sr-pins button:focus-visible {
    /* Viewport-anchored in Chromium: containment (the map pane / map viewport
       size containers) does not re-anchor fixed-position descendants —
       verified live, the bubble renders at the viewport corner. Spec-literal
       engines may disagree: css-contain-2 layout containment establishes a
       fixed-position containing block, so a container-anchored bubble is
       possible there. The phone map tab's top: 15rem offset clears the
       floating bar under either reading — container-top + 240px still lands
       below the bar band. Two further traps need the rules below: the list's
       clip-path subtree-clips even fixed descendants (the :has rule releases
       it while a pin is focused), and a contained ancestor's stacking context
       pins the bubble below page chrome on the phone map tab (the page rule
       drops the bubble below the floating bar's strip instead). */
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
    /* Display artifact of the focus bubble only — never an interaction
       target, so hit-tests at the bubble resolve to the button itself. */
    display: none;
    pointer-events: none;
  }
  .sr-pins button:focus-visible .pin-label {
    display: inline;
  }
  .map-canvas {
    /* No fixed floor: the pane's grid row is the height authority (the row
       can be shorter than any pixel minimum on short viewports, and a floor
       here would overflow it). On the phone tab the pane itself is sized to
       the viewport, so height 100% still fills it. */
    min-height: 0;
    height: 100%;
    width: 100%;
  }
  /* Flag-guarded camera controls: parked on the map's right edge, roughly
     vertical center — clear of the attribution control (bottom-right) and
     the phone tab bar (bottom). Placement is a candidate; it settles in a
     dev trial. The shared :focus-visible ring in app.css covers focus. */
  .map-camera-controls {
    position: absolute;
    right: 0.5rem;
    top: 40%;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .map-camera-controls button {
    width: 2rem;
    height: 2rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
  }
  .map-camera-controls button:hover {
    border-color: var(--accent);
    color: var(--accent-hover);
  }
  .map-camera-controls button:active {
    background: var(--surface-selected);
    border-color: var(--accent-hover);
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
