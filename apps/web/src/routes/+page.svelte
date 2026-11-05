<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { housingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";
  import { viewportState } from "#lib/state/viewport.svelte.ts";
  import DetailSlideOver from "#lib/components/DetailSlideOver.svelte";
  import FilterBar from "#lib/components/FilterBar.svelte";
  import MapView from "#lib/components/MapView.svelte";
  import UnitCardList from "#lib/components/UnitCardList.svelte";
  import MobileFilterSheet from "#lib/components/MobileFilterSheet.svelte";

  let { store = housingStore }: { store?: typeof housingStore } = $props();

  const isPhone = $derived(viewportState.isPhone);

  $effect(() => {
    void store.initialize();
  });

  function onTabKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      uiState.mobileTab = uiState.mobileTab === "map" ? "list" : "map";
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const buttons = Array.from(
        (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>(
          '[role="tab"]',
        ) ?? [],
      );
      const current = buttons.findIndex(
        (button) => button.getAttribute("aria-selected") === "true",
      );
      const nextIndex = (current + direction + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    }
  }
</script>

<div class:phone={isPhone} class:map-active={isPhone && uiState.mobileTab === "map"}>
  {#if isPhone}
    <div class="mobile-bar">
      <div class="tab-buttons" role="tablist" aria-label={m.mobile_tab_list_label()}>
        <button
          type="button"
          role="tab"
          id="tab-map"
          aria-controls="mobile-view"
          aria-selected={uiState.mobileTab === "map"}
          tabindex={uiState.mobileTab === "map" ? 0 : -1}
          onclick={() => (uiState.mobileTab = "map")}
          onkeydown={onTabKeydown}
        >
          {m.mobile_tab_map()}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-list"
          aria-controls="mobile-view"
          aria-selected={uiState.mobileTab === "list"}
          tabindex={uiState.mobileTab === "list" ? 0 : -1}
          onclick={() => (uiState.mobileTab = "list")}
          onkeydown={onTabKeydown}
        >
          {m.mobile_tab_list()}
        </button>
      </div>
      <button type="button" class="filter-open" onclick={() => (uiState.filterSheetOpen = true)}>
        {m.mobile_open_filter_sheet()}
      </button>
    </div>
    <div
      class="mobile-viewport"
      role="tabpanel"
      id="mobile-view"
      aria-labelledby={uiState.mobileTab === "map" ? "tab-map" : "tab-list"}
    >
      {#if uiState.mobileTab === "map"}
        <MapView {store} />
      {:else}
        <UnitCardList {store} />
      {/if}
    </div>
    <!-- Shell level (not inside the viewport): the map-active viewport's
         containment stacking context would paint this fixed sheet below the
         floating tab bar. position: fixed makes it parent-agnostic. -->
    <DetailSlideOver {store} />
    <MobileFilterSheet {store} />
  {:else}
    <!-- Desktop: filter bar above BOTH panes; interactive map LEFT, card list RIGHT (spec-pinned). -->
    <div class="desktop-layout">
      <div class="filter-pane">
        <FilterBar {store} />
      </div>
      <div class="map-pane">
        <MapView {store} />
      </div>
      <div class="list-pane">
        <UnitCardList {store} />
      </div>
      <DetailSlideOver {store} />
    </div>
  {/if}
</div>

<style>
  .desktop-layout {
    position: relative;
    display: grid;
    /* Map column takes the remaining width (shrinkable), the card list is
       capped at 32rem so a wide map column keeps room for its aspect cap. */
    grid-template-columns: minmax(0, 1fr) minmax(26rem, 32rem);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.5rem;
    height: calc(100vh - 8.25rem);
    padding: 0.5rem;
    min-height: 0;
  }
  .filter-pane {
    grid-column: 1 / -1;
    min-height: 0;
  }
  .map-pane {
    grid-column: 1;
    min-height: 0;
    display: grid;
    /* Shrinkable tracks: without them the implicit auto tracks size to the
       map's mounted canvas and the pane can never shrink with its row. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    /* The map is height-bound (never wider than half again the pane height), so
       wide columns center the capped map instead of stretching a wide strip. */
    justify-items: center;
    /* Size container: the map view reads the pane height through container
       query units to hold its 3:2 cap. */
    container-type: size;
  }
  /* The 3:2 width cap lives on the pane side because container query units
     resolve against the nearest eligible ancestor — this size container.
     The phone map tab has no such container and must keep its full-width
     stretch, so the cap must not leak into the shared map component. */
  .map-pane :global(.map-view) {
    width: min(100%, calc(100cqh * 3 / 2));
  }
  .list-pane {
    grid-column: 2;
    min-height: 0;
    display: grid;
    /* Shrinkable rows: the card list must fill this pane's height (its own
       scroll containment) instead of sizing its row to the full card stack. */
    grid-template-rows: minmax(0, 1fr);
  }
  /* phone-width layout (viewport state switches markup) */
  .mobile-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--line);
  }
  .tab-buttons {
    display: flex;
    gap: 0.25rem;
  }
  .tab-buttons button,
  .filter-open {
    font: inherit;
    padding: 0.45rem 1rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--ink);
  }
  .tab-buttons button[aria-selected="true"] {
    background: var(--accent);
    color: var(--ink-on-accent);
    border-color: var(--accent);
  }
  .filter-open {
    margin-left: auto;
    font-weight: 600;
  }
  .mobile-viewport {
    height: calc(100vh - 15.5rem);
    display: grid;
    min-height: 0;
  }
  :global(.phone) {
    display: block;
  }
  /* --- Phone map tab: floating tab bar + square-capped centered map ---
     Keyed on the map-active shell class, so the list tab keeps the in-flow
     bar and today's heights. The bar floats over the map, and the flex chain
     (body > main > phone shell > viewport) gives the map viewport exactly the
     screen height the bar vacated — no fixed height constants, so banner
     rewraps at any width can never overflow the page. (The body rule uses a
     descendant :has — Chrome does not match child-combinator :has on body.)
     The whole layout block is gated on :has support — including the square
     cap, whose container units only resolve against the size container
     declared in here: engines with container queries but without :has would
     otherwise flex-collapse the shell into a blank map tab, and their
     landscape viewport-unit square (~390px tall) would overflow the ~142px
     fallback row. Those engines keep the plain old layout: in-flow bar,
     fixed-height viewport, full-width uncapped map. */
  @supports selector(:has(*)) {
    :global(body:has(.phone.map-active)) {
      display: flex;
      flex-direction: column;
    }
    :global(main:has(> .phone.map-active)) {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    :global(.phone.map-active) {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    :global(.phone.map-active) .mobile-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
    }
    :global(.phone.map-active) .mobile-viewport {
      flex: 1;
      min-height: 0;
      container-type: size;
    }
    :global(.phone.map-active) .mobile-viewport :global(.map-view) {
      /* Square cap with a deliberate inset on the binding axis: the pane is
         never wider than the viewport (minus 0.75rem breathing room) nor
         taller than it (same breathing room), whichever binds — portrait
         insets the left/right sides, landscape insets top/bottom — so the
         bordered square never sits flush against a screen edge
         (user-confirmed look). Centered in the viewport. Container units
         resolve against the viewport's size container above; this rule must
         stay phone-scoped (the desktop pane carries its own 3:2 cap). */
      width: min(100%, calc(100cqw - 1.5rem), calc(100cqh - 1.5rem));
      height: min(calc(100cqw - 1.5rem), calc(100cqh - 1.5rem));
      justify-self: center;
      align-self: center;
    }
  }
  /* The sr-pin focus bubble keeps viewport anchoring, but the map-active
     viewport's containment stacking context traps its z-index below page
     chrome, so at the shared top-left offset the page banner and the floating
     tab bar paint over it. Dropping the bubble below the bar's strip puts it
     over open map canvas in both orientations (banner+header ≈ 122–142px,
     bar bottom ≈ 179–199px, legend starts far lower). */
  :global(.phone.map-active) :global(.sr-pins button:focus-visible) {
    top: 15rem;
  }
</style>
