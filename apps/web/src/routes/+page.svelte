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

<div class:phone={isPhone}>
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
      <DetailSlideOver {store} />
    </div>
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
    grid-template-columns: 1fr minmax(22rem, 26rem);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.75rem;
    height: calc(100vh - 9.5rem);
    padding: 0.75rem;
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
  }
  .list-pane {
    grid-column: 2;
    min-height: 0;
    display: grid;
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
</style>
