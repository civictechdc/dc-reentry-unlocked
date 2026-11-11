<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { page } from "$app/state";

  /**
   * Plain-language error page (client-rendered — the server shell is served
   * for every route). Internal error details are never exposed.
   */
  const isNotFound = $derived(page.status === 404);
</script>

<section class="error-panel">
  {#if isNotFound}
    <h2>{m.error_not_found_title()}</h2>
    <p>{m.error_not_found_body()}</p>
    <a class="cta" href="/">{m.error_not_found_cta()}</a>
  {:else}
    <h2>{m.error_fallback_title()}</h2>
    <p>{m.error_fallback_body()}</p>
    <a class="cta" href="/">{m.error_not_found_cta()}</a>
  {/if}
</section>

<style>
  .error-panel {
    max-width: 40rem;
    margin: 4rem auto;
    padding: var(--spacing-xxl);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-line);
    border-radius: var(--rounded-control);
  }
  h2 {
    margin-top: 0;
  }
  .cta {
    display: inline-block;
    margin-top: var(--spacing-lg);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-accent);
    color: var(--color-ink-on-accent);
    border-radius: var(--rounded-control);
    text-decoration: none;
    font-weight: 600;
  }
  .cta:hover {
    background: var(--color-accent-hover);
  }
</style>
