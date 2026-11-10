<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { FilterDefinition } from "@dc-reentry/shared";
  import { housingStore } from "#lib/state/housing-store.svelte.ts";

  let { store = housingStore }: { store?: typeof housingStore } = $props();

  /**
   * Active selections as individually removable chips beneath the filter
   * bar, with a clear-all affordance.
   */
  const activeFilters = $derived(
    Object.entries(store.selection).map(([filterId, values]) => ({
      filterId,
      definition: store.filtersSchema.find((candidate) => candidate.id === filterId),
      values,
    })),
  );
  const hasAnySelection = $derived(
    Object.values(store.selection).some((values) => values.length > 0),
  );

  function valueLabel(definition: FilterDefinition | undefined, value: string): string {
    if (definition?.control === "boolean") {
      return value === "yes" ? m.filter_boolean_yes() : m.filter_boolean_no();
    }
    return definition?.options?.find((option) => option.value === value)?.label ?? value;
  }

  function chipLabel(definition: FilterDefinition | undefined, value: string): string {
    return m.chip_active_label({
      filter: definition?.label ?? value,
      value: valueLabel(definition, value),
    });
  }

  function removeChip(filterId: string, value: string): void {
    store.apply({ kind: "remove-value", filterId, value });
  }
</script>

{#if hasAnySelection}
  <ul class="chips" aria-label={m.chips_region_label()}>
    {#each activeFilters as active (active.filterId)}
      {#each active.values as value (value)}
        {#if active.definition}
          <li class="chip">
            {chipLabel(active.definition, value)}
            <button
              type="button"
              aria-label={m.chip_remove({
                filter: active.definition.label,
                value: valueLabel(active.definition, value),
              })}
              onclick={() => removeChip(active.filterId, value)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        {/if}
      {/each}
    {/each}
  </ul>
  <button type="button" class="clear-all-chips" onclick={() => store.clearAll()}>
    {m.chip_clear_all()}
  </button>
{/if}

<style>
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--color-surface-selected);
    border: 1px solid var(--color-line);
    border-radius: var(--rounded-pill);
    padding: 0.15rem 0.35rem 0.15rem 0.65rem;
    font-size: var(--font-size-small);
  }
  .chip button {
    font: inherit;
    font-size: 0.75rem;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    padding: 0.1rem 0.35rem;
    border-radius: var(--rounded-pill);
  }
  .clear-all-chips {
    align-self: start;
    font: inherit;
    font-size: var(--font-size-small);
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
</style>
