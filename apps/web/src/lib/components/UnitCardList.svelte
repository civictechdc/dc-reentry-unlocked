<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";
  import ActiveChips from "./ActiveChips.svelte";
  import UnitCard from "./UnitCard.svelte";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /**
   * Retry: schema reload first (the retry affordance exists for schema
   * failures too), then the units refresh it triggers — sequenced, no
   * concurrent empty-schema window.
   */
  function retry(): void {
    void store.reloadSchema();
  }
</script>

<section class="unit-list" aria-label={m.app_heading()}>
  {#if store.phase === "loading" && store.units === null}
    <ul class="cards">
      {#each { length: 8 } as _, index (index)}
        <li class="skeleton-row" aria-hidden="true">
          <div class="skeleton-box"></div>
        </li>
      {/each}
    </ul>
    <span class="sr-only">{m.results_loading()}</span>
  {:else if store.phase === "error" && store.units === null}
    <div class="panel error-panel" role="alert">
      <h3>{m.results_error_headline()}</h3>
      <p>{m.results_error_body()}</p>
      <button type="button" onclick={retry}>{m.results_retry()}</button>
    </div>
  {:else if store.units !== null && store.units.length === 0}
    <div class="panel zero-panel">
      {#if store.failure}
        <h3 role="alert">{m.results_zero_headline()}</h3>
        <p role="alert">{m.results_error_headline()}</p>
        <p role="alert">{m.results_error_body()}</p>
      {:else}
        <h3>{m.results_zero_headline()}</h3>
        <p>{m.results_zero_body()}</p>
      {/if}
      <ActiveChips {store} />
      {#if store.failure}
        <button type="button" onclick={retry}>{m.results_retry()}</button>
      {/if}
    </div>
  {:else if store.units}
    {#if store.phase === "error"}
      <div class="retry-banner" role="alert">
        <p>
          {m.results_error_headline()}
          {m.results_error_body()}
        </p>
        <button type="button" onclick={retry}>{m.results_retry()}</button>
      </div>
    {/if}
    <p class="result-count" role="status">
      {m.results_count({ count: store.units.length })}
    </p>
    <ul class="cards">
      {#each store.units as card, index (card.id)}
        <li>
          <UnitCard {card} selected={uiState.selectedUnitId === card.id} />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .unit-list {
    display: grid;
    gap: 0.5rem;
    align-content: start;
    min-height: 0;
    overflow-y: auto;
    /* Layout containment: an oversized inner track (the full card stack)
       must not extend this pane's scrollable overflow into the page — the
       overflow-y clip alone does not stop that propagation in every engine,
       and this pane is the card stack's only scroll boundary. */
    contain: layout;
    padding: 0.5rem;
  }
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .panel {
    background: var(--surface-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  h3,
  p {
    margin: 0;
  }
  .error-panel button,
  .retry-banner button,
  .zero-panel button {
    font: inherit;
    padding: 0.4rem 0.9rem;
    background: var(--accent);
    color: var(--ink-on-accent);
    border: 0;
    border-radius: var(--radius);
  }
  .retry-banner {
    background: var(--surface-warning);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    display: grid;
    gap: 0.5rem;
  }
  .result-count {
    margin: 0;
    font-size: 0.875rem;
    color: var(--ink-muted);
  }
  .skeleton-row {
    list-style: none;
  }
  .skeleton-box {
    height: 6.5rem;
    border-radius: var(--radius);
    background: linear-gradient(90deg, var(--line), var(--surface-raised), var(--line));
    background-size: 200% 100%;
    animation: shimmer 1.2s infinite;
  }
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
