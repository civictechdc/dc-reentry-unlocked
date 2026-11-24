<script lang="ts">
  import { tick, untrack } from "svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";
  import FilterBar from "./FilterBar.svelte";
  import { chipsOverflow } from "./chips-overflow.ts";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /**
   * Phone width: with the sheet closed, a summary strip of per-filter count
   * chips in the "{filter} ({count} selected)" format. Chips scroll
   * horizontally; activation opens the filter sheet (the selection is never
   * touched from the strip). A clear-all control sits fixed at the strip's
   * trailing edge, outside the scrolling chips, and a `+N more` chip appears
   * when the count chips run past the visible width. The strip holds one
   * fixed height whether the selection is empty or full.
   */

  const summarized = $derived.by(() => {
    if (!uiState.filterSheetOpen) {
      return Object.entries(store.selection).map(([filterId, values]) => ({
        filterId,
        values,
        definition: store.filtersSchema.find((candidate) => candidate.id === filterId),
      }));
    }
    return [];
  });
  const hasSelection = $derived(summarized.length > 0);

  // --- Overflow measurement -------------------------------------------------
  // The same partition discipline as the desktop band: the pure
  // `chipsOverflow` math decides when the `+N more` disclosure and the
  // trailing scroll fade are needed. Nothing is clipped or inert here — the
  // strip scrolls, so every count chip stays reachable; the partition only
  // measures how much content sits beyond the visible edge.

  // Space the trigger needs beside the last fully visible chip while it has
  // not rendered yet; replaced by the measured width as soon as it has.
  const TRIGGER_RESERVE_ESTIMATE_PX = 90;

  let scrollEl: HTMLDivElement | undefined = $state();

  let partition = $state({ visibleCount: 0, hiddenCount: 0 });
  let scrolledToEnd = $state(false);

  function setPartition(next: { visibleCount: number; hiddenCount: number }): void {
    if (
      next.visibleCount === partition.visibleCount &&
      next.hiddenCount === partition.hiddenCount
    ) {
      return;
    }
    partition = next;
  }

  function measure(): void {
    const scroll = scrollEl;
    if (!scroll) return;
    const chipEls = Array.from(
      scroll.querySelectorAll<HTMLLIElement>("li.count-chip:not(.more-trigger)"),
    );
    if (chipEls.length === 0) {
      setPartition({ visibleCount: 0, hiddenCount: 0 });
      scrolledToEnd = true;
      return;
    }
    const rects = chipEls.map((chip) => chip.getBoundingClientRect());
    const widths = rects.map((rect) => rect.width);
    // The flex gap comes from the computed style, never from DOM positions —
    // positions of chips past the trigger include its displacement.
    const list = scroll.querySelector("ul");
    const gap = list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0;
    const triggerWidth =
      scroll.querySelector("li.more-trigger")?.getBoundingClientRect().width ?? 0;
    const reserve = triggerWidth > 0 ? gap + triggerWidth : TRIGGER_RESERVE_ESTIMATE_PX;
    // Chip right edges anchor at the list's left padding, not the
    // scrollport edge — subtract it so the last "visible" chip cannot
    // overhang the visible strip width.
    const listPaddingLeft = list ? parseFloat(getComputedStyle(list).paddingLeft) || 0 : 0;
    const rowWidth = Math.max(0, scroll.clientWidth - listPaddingLeft);
    setPartition(chipsOverflow(widths, gap, rowWidth, reserve));
    scrolledToEnd = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
  }

  function onScroll(): void {
    const scroll = scrollEl;
    if (!scroll) return;
    scrolledToEnd = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
  }

  // The rendered chip set is the measurement's trigger; the strip element
  // binding and the sheet state gate it. DOM reads stay untracked — the chip
  // set is the only dependency, so re-partitioning cannot re-enter it.
  let settledSignature: string | null = null;
  $effect(() => {
    const signature = summarized
      .map((entry) => `${entry.filterId}:${entry.values.length}`)
      .join("|");
    void uiState.filterSheetOpen;
    void scrollEl;
    untrack(() => {
      measure();
      // The partition's own render changes the measured trigger width; one
      // settle re-measure per chip-set change keeps the reserve honest
      // without ping-ponging on sub-pixel boundaries.
      if (partition.hiddenCount > 0 && settledSignature !== signature) {
        settledSignature = signature;
        void tick().then(() => untrack(() => measure()));
      }
    });
  });

  $effect(() => {
    if (uiState.filterSheetOpen || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    if (scrollEl) observer.observe(scrollEl);
    return () => observer.disconnect();
  });

  let opener: HTMLElement | null = $state(null);
  /** The count chip's filter id when the sheet was opened from the strip. */
  let openerFilterId: string | null = $state(null);
  let panel: HTMLElement | undefined = $state();
  let stripEl: HTMLDivElement | undefined = $state();

  function open(filterId?: string): void {
    opener = document.activeElement as HTMLElement | null;
    openerFilterId = filterId ?? null;
    uiState.filterSheetOpen = true;
  }
  function close(): void {
    const restoreFilterId = openerFilterId;
    const restoreEl = opener;
    uiState.filterSheetOpen = false;
    opener = null;
    openerFilterId = null;
    // The strip unmounts while the sheet is open, so the opener element is
    // gone by now — restore focus to the re-rendered count chip for the
    // same filter, falling back to the opener element or the Filters
    // button, never the page body.
    void (async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await tick();
        if (restoreFilterId) {
          const chip = document.querySelector<HTMLButtonElement>(
            `.summary-row [data-count-filter=${CSS.escape(restoreFilterId)}]`,
          );
          if (chip) {
            chip.focus();
            if (document.activeElement === chip) return;
          }
        }
        if (restoreEl?.isConnected) {
          restoreEl.focus();
          if (document.activeElement === restoreEl) return;
        }
        const filtersButton = document.querySelector<HTMLButtonElement>(".filter-open");
        if (filtersButton) {
          filtersButton.focus();
          if (document.activeElement === filtersButton) return;
        }
      }
    })();
  }

  $effect(() => {
    if (uiState.filterSheetOpen && panel) panel.focus();
  });

  function onKeydown(event: KeyboardEvent): void {
    if (!uiState.filterSheetOpen) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    // simple circular focus trap over focusable controls inside the sheet
    if (event.key === "Tab") {
      const focusable = Array.from(
        panel?.querySelectorAll<HTMLElement>("a[href], button, select, [tabindex='0']") ?? [],
      ).filter((candidate) => !candidate.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if !uiState.filterSheetOpen}
  <div
    class="summary-row"
    role="region"
    aria-label={m.filter_region_label()}
    bind:this={stripEl}
    tabindex="-1"
  >
    <div class="strip-body">
      <div class="strip-scroll" bind:this={scrollEl} onscroll={onScroll}>
        <ul class="count-chips" aria-label={m.chips_region_label()}>
          <!-- Nothing fits beside the disclosure: the trigger leads the row
               so it stays inside the visible strip and reachable. -->
          {#if partition.hiddenCount > 0 && partition.visibleCount === 0}
            <li class="count-chip more-trigger">
              <button type="button" onclick={() => open()}>
                {m.chip_more_count({ count: partition.hiddenCount })}
              </button>
            </li>
          {/if}
          {#each summarized as entry, index (entry.filterId)}
            <li class="count-chip">
              <button
                type="button"
                data-count-filter={entry.filterId}
                onclick={() => open(entry.filterId)}
              >
                {m.filter_count_chip({
                  filter: entry.definition?.label ?? entry.filterId,
                  count: entry.values.length,
                })}
              </button>
            </li>
            {#if partition.hiddenCount > 0 && index === partition.visibleCount - 1}
              <li class="count-chip more-trigger">
                <button type="button" onclick={() => open()}>
                  {m.chip_more_count({ count: partition.hiddenCount })}
                </button>
              </li>
            {/if}
          {/each}
        </ul>
      </div>
      {#if partition.hiddenCount > 0 && !scrolledToEnd}
        <span class="strip-fade" aria-hidden="true"></span>
      {/if}
    </div>
    <div class="strip-clear">
      {#if hasSelection}
        <button
          type="button"
          class="strip-clear-all"
          onclick={async () => {
            // Focus the strip synchronously: the unmounting button never
            // drops focus to the page body during the refresh.
            stripEl?.focus();
            await store.clearAll();
            if (document.activeElement === document.body) stripEl?.focus();
          }}
        >
          {m.filter_clear_all()}
        </button>
      {/if}
    </div>
  </div>
{:else}
  <div class="sheet-root" data-testid="filter-sheet">
    <div
      bind:this={panel}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label={m.mobile_filter_sheet_title()}
    >
      <div class="sheet-actions">
        <h2>{m.mobile_filter_sheet_title()}</h2>
        <button type="button" class="apply" onclick={close}>{m.mobile_apply_filters()}</button>
        <button type="button" class="close" onclick={close}>{m.mobile_close_filter_sheet()}</button>
      </div>
      <FilterBar {store} />
    </div>
  </div>
{/if}

<style>
  /* One fixed strip height (reserved geometry): the clear-all button's
     appearance and the chip count never change it, so the centered map
     square holds its position across apply, remove, and clear. */
  .summary-row {
    display: flex;
    align-items: stretch;
    height: 2.875rem;
    background: var(--color-surface-raised);
    border-bottom: 1px solid var(--color-line);
  }
  .strip-body {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
  }
  .strip-scroll {
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    align-items: center;
    /* Block padding reserves room for the shared focus ring around focused
       count chips while the strip holds its fixed height. */
    padding-block: var(--spacing-sm);
    /* The trailing fade is the overflow affordance — a classic scrollbar
       would steal ~15px of the strip's 46px and clip focused rings. */
    scrollbar-width: none;
  }
  .strip-scroll::-webkit-scrollbar {
    display: none;
  }
  .count-chips {
    list-style: none;
    margin: 0;
    padding: 0 var(--spacing-md);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .count-chip {
    flex: none;
  }
  /* The disclosure trigger paints above the trailing scroll fade: it must
     stay fully legible whenever it is shown. */
  .count-chip.more-trigger {
    position: relative;
    z-index: 1;
  }
  .count-chip button {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-pill);
    background: var(--color-surface-raised);
    color: var(--color-ink);
    white-space: nowrap;
  }
  .more-trigger button {
    border-style: dashed;
  }
  /* Trailing scroll fade: the strip's own surface dissolving over the chips
     beyond the visible edge. */
  .strip-fade {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 2.5rem;
    pointer-events: none;
    background: linear-gradient(to right, transparent, var(--color-surface-raised));
  }
  .strip-clear {
    flex: none;
    display: flex;
    align-items: center;
  }
  .strip-clear-all {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
    margin-right: var(--spacing-md);
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
    white-space: nowrap;
  }
  .sheet-root {
    position: fixed;
    inset: 0;
    background: var(--color-surface);
    z-index: 50;
    overflow-y: auto;
  }
  .sheet-root > div {
    display: grid;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }
  .sheet-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  h2 {
    margin: 0;
    font-size: 1rem;
    margin-right: auto;
  }
  .sheet-actions button {
    font: inherit;
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
  .sheet-actions .apply {
    background: var(--color-accent);
    color: var(--color-ink-on-accent);
    border-color: var(--color-accent);
    font-weight: 600;
  }
</style>
