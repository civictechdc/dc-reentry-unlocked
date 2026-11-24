<script lang="ts">
  import { untrack } from "svelte";
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

  // Announced text of the result-feedback region (see the markup below).
  // Driven by committed results only: the effect tracks store.units, and the
  // pending selection signature is sampled untracked at the moment results
  // land — a mid-refresh selection write never announces a stale count.
  let statusText = $state("");
  let lastAnnouncedText = "";
  let lastAnnouncedSignature = "";
  let restoreScheduled = false;
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;

  function clearPendingRestore(): void {
    if (restoreTimer !== undefined) clearTimeout(restoreTimer);
    restoreTimer = undefined;
    restoreScheduled = false;
  }

  $effect(() => {
    const units = store.units;
    if (units === null) {
      clearPendingRestore();
      statusText = "";
      lastAnnouncedText = "";
      lastAnnouncedSignature = "";
      return;
    }
    const text = m.results_count({ count: units.length });
    // The pending selection signature is sampled untracked: a mid-refresh
    // selection write must never re-run this effect (it would announce a
    // stale count — the previous units are still committed).
    const signature = untrack(() => JSON.stringify(store.selection));
    const restoreNow = () => {
      restoreTimer = undefined;
      restoreScheduled = false;
      statusText = text;
      lastAnnouncedText = text;
      lastAnnouncedSignature = signature;
    };
    if (restoreScheduled) {
      // A blank+restore is pending from an identical-count commit. If a
      // newer count-changing result lands meanwhile, supersede the restore
      // (no replay of the older text) and announce the new count directly.
      // If another identical-count commit lands instead, reschedule with the
      // NEWEST text/signature — otherwise the recorded signature stays the
      // older one and a later unrelated refresh re-announces.
      if (text !== lastAnnouncedText) {
        clearPendingRestore();
        restoreNow();
        return;
      }
      if (signature === lastAnnouncedSignature) {
        // The selection returned to the one recorded as announced: cancel
        // the pending restore (it would record the other signature) and set
        // the text directly — one announcement, and the announced selection
        // stays recorded, so a later unrelated refresh stays silent.
        clearPendingRestore();
        statusText = text;
        return;
      }
      if (signature !== lastAnnouncedSignature) {
        clearPendingRestore();
        restoreScheduled = true;
        statusText = "";
        restoreTimer = setTimeout(restoreNow);
      }
      return;
    }
    if (text === lastAnnouncedText && signature === lastAnnouncedSignature) return;
    if (text === lastAnnouncedText) {
      // A committed result with an unchanged count but a changed selection
      // still announces: blank the region and restore on a macrotask (a
      // same-task mutation would be coalesced and never announce).
      restoreScheduled = true;
      statusText = "";
      restoreTimer = setTimeout(restoreNow);
      return;
    }
    restoreNow();
  });
  // Effect teardown: a pending restore must not fire after unmount.
  $effect(() => () => clearPendingRestore());

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
        <FilterBar {store} summaryBand />
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
{#if store.units !== null}
  <!-- Result feedback: one always-mounted polite status region carrying the
       matching-unit count, so apply/change/remove/clear announce on every
       surface (desktop, phone map tab, phone list tab, zero results) — the
       card list unmounts on the phone map tab, so the region lives in the
       shell. It mounts only once results have loaded (never announces the
       first-boot loading or error phase) and never moves focus. The card
       list's visible count line is plain text, keeping exactly one live
       region on the page. A selection change that leaves the count
       identical blanks the text and restores it on a macrotask, so the
       change still announces; unrelated re-renders stay silent. The
       blank+restore pair is separated by that macrotask so assistive tech
       observes both mutations, and a pending restore is superseded (timer
       cleared) when a newer count-changing result lands. -->
  <p class="results-status" role="status">{statusText}</p>
{/if}

<style>
  .desktop-layout {
    position: relative;
    display: grid;
    /* Map column takes the remaining width (shrinkable), the card list is
       capped at 32rem so a wide map column keeps room for its aspect cap. */
    grid-template-columns: minmax(0, 1fr) minmax(26rem, 32rem);
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--spacing-sm);
    height: calc(100vh - 8.25rem);
    padding: var(--spacing-sm);
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
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-surface-raised);
    border-bottom: 1px solid var(--color-line);
  }
  .tab-buttons {
    display: flex;
    gap: var(--spacing-xs);
  }
  .tab-buttons button,
  .filter-open {
    font: inherit;
    padding: 0.45rem 1rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
  .tab-buttons button[aria-selected="true"] {
    background: var(--color-accent);
    color: var(--color-ink-on-accent);
    border-color: var(--color-accent);
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
  /* Announced, never shown: the visible count lives in the card list. */
  .results-status {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
