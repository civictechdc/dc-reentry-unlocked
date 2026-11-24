<script lang="ts">
  import { tick } from "svelte";
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

  /** Persistent standing point for zero-panel removals on failed refreshes. */
  function focusZeroPanel(): void {
    zeroPanelEl?.focus();
  }

  /**
   * When the zero panel's chips empty the selection — or a removal recovers
   * results while selections remain — this list swaps to the counted branch
   * and keyboard focus lands on the count line instead of dropping to the
   * page body. The count line mounts a flush or two after the store's
   * async refresh settles, so poll briefly.
   */
  function focusCountLine(): void {
    void (async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await tick();
        if (countEl && document.activeElement !== countEl) countEl.focus();
        if (document.activeElement === countEl) return;
      }
    })();
  }

  let countEl: HTMLParagraphElement | undefined = $state();
  let zeroPanelEl: HTMLDivElement | undefined = $state();

  /**
   * Zero→results render transition: when the panel unmounts while its own
   * controls held focus (a removal whose chip left the DOM mid-await), the
   * count line — not the page body — takes focus, independent of any
   * request. A user who moved focus somewhere real is left alone.
   */
  const showZeroPanel = $derived(store.units !== null && store.units.length === 0);
  let zeroPanelHadFocus = false;
  let zeroPanelWasShown = false;

  function onZeroPanelFocusout(event: FocusEvent): void {
    const next = event.relatedTarget;
    // A targetless (or already-detached) relatedTarget means the focused
    // control just left the DOM — keep the flag; only a real move somewhere
    // outside the panel clears it.
    if (next instanceof Node && next.isConnected && !zeroPanelEl?.contains(next)) {
      zeroPanelHadFocus = false;
    }
  }

  $effect(() => {
    const showing = showZeroPanel;
    if (showing) {
      zeroPanelWasShown = true;
      return;
    }
    if (!zeroPanelWasShown) return;
    zeroPanelWasShown = false;
    if (!zeroPanelHadFocus) return;
    void (async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await tick();
        if (document.activeElement !== document.body) {
          zeroPanelHadFocus = false;
          return;
        }
        if (!countEl) continue;
        countEl.focus();
        if (document.activeElement === countEl) {
          zeroPanelHadFocus = false;
          return;
        }
      }
    })();
  });
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
    <div
      class="panel zero-panel"
      bind:this={zeroPanelEl}
      tabindex="-1"
      onfocusin={() => (zeroPanelHadFocus = true)}
      onfocusout={onZeroPanelFocusout}
    >
      {#if store.failure}
        <h3 role="alert">{m.results_zero_headline()}</h3>
        <p role="alert">{m.results_error_headline()}</p>
        <p role="alert">{m.results_error_body()}</p>
      {:else}
        <h3>{m.results_zero_headline()}</h3>
        <p>{m.results_zero_body()}</p>
      {/if}
      <ActiveChips {store} onEmptied={focusCountLine} onFallbackFocus={focusZeroPanel} />
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
    <!-- Plain text: the shell carries the single announced status region. -->
    <p class="result-count" bind:this={countEl} tabindex="-1">
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
    gap: var(--spacing-sm);
    align-content: start;
    min-height: 0;
    overflow-y: auto;
    /* Layout containment: an oversized inner track (the full card stack)
       must not extend this pane's scrollable overflow into the page — the
       overflow-y clip alone does not stop that propagation in every engine,
       and this pane is the card stack's only scroll boundary. */
    contain: layout;
    padding: var(--spacing-sm);
  }
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-sm);
  }
  .panel {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-line);
    border-radius: var(--rounded-control);
    padding: 1.25rem;
    display: grid;
    gap: var(--spacing-sm);
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
    background: var(--color-accent);
    color: var(--color-ink-on-accent);
    border: 0;
    border-radius: var(--rounded-control);
  }
  .retry-banner {
    background: var(--color-surface-warning);
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    padding: var(--spacing-md) var(--spacing-lg);
    display: grid;
    gap: var(--spacing-sm);
  }
  .result-count {
    margin: 0;
    font-size: var(--font-size-small);
    color: var(--color-ink-muted);
  }
  .skeleton-row {
    list-style: none;
  }
  .skeleton-box {
    height: 6.5rem;
    border-radius: var(--rounded-control);
    background: linear-gradient(
      90deg,
      var(--color-line),
      var(--color-surface-raised),
      var(--color-line)
    );
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
