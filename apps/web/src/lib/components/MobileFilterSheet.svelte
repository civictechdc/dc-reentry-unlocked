<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";
  import FilterBar from "./FilterBar.svelte";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /** horizontally scrollable filter summary → full-filter sheet (phone width). */

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

  function open(): void {
    opener = document.activeElement as HTMLElement | null;
    uiState.filterSheetOpen = true;
  }
  function close(): void {
    uiState.filterSheetOpen = false;
    // focus returns to the control that opened the sheet
    opener?.focus();
    opener = null;
  }

  let opener: HTMLElement | null = $state(null);
  let panel: HTMLElement | undefined = $state();

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
  <div class="summary-row" aria-label={m.filter_region_label()}>
    {#each summarized as entry (entry.filterId)}
      <button
        type="button"
        class="summary-chip"
        onclick={() => {
          for (const value of entry.values) {
            store.apply({ kind: "remove-value", filterId: entry.filterId, value });
          }
        }}
      >
        {entry.definition?.label ?? entry.filterId}: {entry.values.length}
      </button>
    {/each}
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
  .summary-row {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0.5rem 0.75rem;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  .summary-chip {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface-raised);
    color: var(--ink);
    flex: none;
  }
  .sheet-root {
    position: fixed;
    inset: 0;
    background: var(--surface);
    z-index: 50;
    overflow-y: auto;
  }
  .sheet-root > div {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
  }
  .sheet-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
    margin-right: auto;
  }
  .sheet-actions button {
    font: inherit;
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--ink);
  }
  .sheet-actions .apply {
    background: var(--accent);
    color: var(--ink-on-accent);
    border-color: var(--accent);
    font-weight: 600;
  }
</style>
