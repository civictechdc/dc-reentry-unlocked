<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { FilterDefinition, FilterOption } from "@dc-reentry/shared";
  import { housingStore, SUPPORTED_CONTROLS } from "#lib/state/housing-store.svelte.ts";
  import ActiveChips from "./ActiveChips.svelte";

  let { store = housingStore }: { store?: typeof housingStore } = $props();

  /**
   * Schema-rendered filter bar: every control is a generic renderer over the
   * published filter schema — no filter is hardcoded. Unsupported control
   * types are hidden (graceful degradation), never a crash.
   */
  const renderable = $derived(
    store.filtersSchema.filter((definition) =>
      (SUPPORTED_CONTROLS as readonly string[]).includes(definition.control),
    ),
  );
  const unsupportedCount = $derived(store.filtersSchema.length - renderable.length);

  const selectedFor = (filterId: string): string[] => store.selection[filterId] ?? [];

  function toggleValue(definition: FilterDefinition, value: string): void {
    const current = selectedFor(definition.id);
    const isSelected = current.includes(value);
    if (definition.control === "multi-select") {
      if (isSelected) {
        store.apply({ kind: "remove-value", filterId: definition.id, value });
      } else {
        store.apply({
          kind: "apply",
          filterId: definition.id,
          control: definition.control,
          values: [value],
        });
      }
      return;
    }
    // boolean / single-select: selecting replaces; selecting the active value removes it.
    store.apply({
      kind: "apply",
      filterId: definition.id,
      control: definition.control,
      values: isSelected ? [] : [value],
    });
  }

  function selectForSingleSelect(definition: FilterDefinition, event: Event): void {
    const chosen = (event.target as HTMLSelectElement).value;
    store.apply({
      kind: "apply",
      filterId: definition.id,
      control: definition.control,
      values: chosen.length > 0 ? [chosen] : [],
    });
  }

  const hasAnySelection = $derived(Object.keys(store.selection).length > 0);
</script>

<section class="filter-bar" aria-label={m.filter_region_label()}>
  <div class="filter-controls">
    {#each renderable as definition (definition.id)}
      {#if definition.control === "boolean"}
        <fieldset class="control control-boolean">
          <legend>{definition.label}</legend>
          <div class="toggle-group">
            <button
              type="button"
              aria-pressed={selectedFor(definition.id).includes("yes")}
              onclick={() => toggleValue(definition, "yes")}
            >
              {m.filter_boolean_yes()}
            </button>
            <button
              type="button"
              aria-pressed={selectedFor(definition.id).includes("no")}
              onclick={() => toggleValue(definition, "no")}
            >
              {m.filter_boolean_no()}
            </button>
          </div>
        </fieldset>
      {:else if definition.control === "single-select"}
        <label class="control control-single" for={`filter-${definition.id}`}>
          <span class="control-label">{definition.label}</span>
          <select
            id={`filter-${definition.id}`}
            value={selectedFor(definition.id)[0] ?? ""}
            onchange={(event) => selectForSingleSelect(definition, event)}
          >
            <option value="">{m.filter_select_placeholder()}</option>
            {#each definition.options ?? [] as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      {:else}
        {#if (definition.options ?? []).length > 0}
          <fieldset class="control control-multi">
            <legend>{definition.label}</legend>
            <div class="toggle-group">
              {#each definition.options ?? [] as option (option.value)}
                <button
                  type="button"
                  aria-pressed={selectedFor(definition.id).includes(option.value)}
                  onclick={() => toggleValue(definition, option.value)}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </fieldset>
        {:else}
          <!-- a supported multi-select without options simply has nothing to render -->
        {/if}
      {/if}
    {/each}
  </div>
  <div class="filter-footer">
    {#if unsupportedCount > 0}
      <p class="unsupported-notice">{m.filter_unsupported_notice()}</p>
    {/if}
    {#if hasAnySelection}
      <button type="button" class="clear-all" onclick={() => store.clearAll()}>
        {m.filter_clear_all()}
      </button>
    {/if}
  </div>
  <ActiveChips {store} />
</section>

<style>
  .filter-bar {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-line);
    border-radius: var(--rounded-control);
    padding: 0.375rem 0.75rem;
    display: grid;
    gap: 0.375rem;
  }
  .filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 0.75rem;
  }
  .control {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend,
  .control-label {
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--color-ink);
  }
  select {
    font: inherit;
    font-size: 0.8rem;
    /* Hit-target floor: keep the compacted select at the 24px minimum even
       if font or line-height drifts. */
    min-height: 1.5rem;
    padding: 0.125rem 0.375rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
  .toggle-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }
  .toggle-group button {
    font: inherit;
    font-size: 0.8rem;
    /* Hit-target floor: keep the compacted toggle at the 24px minimum even
       if font or line-height drifts. */
    min-height: 1.5rem;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-pill);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
  .toggle-group button[aria-pressed="true"] {
    background: var(--color-accent);
    color: var(--color-ink-on-accent);
    border-color: var(--color-accent);
  }
  .filter-footer {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    font-size: 0.8rem;
  }
  .unsupported-notice {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-ink-muted);
  }
  .clear-all {
    margin-left: auto;
    font: inherit;
    font-size: 0.8rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
</style>
