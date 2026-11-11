<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";

  /**
   * Persistent, prominent prompt-display disclosure banner (synthetic-data
   * dataset disclaimer language). Rendered from the root layout, so every
   * screen and the error surface carry it.
   */
</script>

<div class="banner" role="note">
  <strong class="banner-title">{m.banner_heading()}</strong>
  <p class="banner-body">{m.banner_body()}</p>
</div>

<style>
  .banner {
    background: var(--color-surface-warning);
    border-bottom: 1px solid var(--color-line-strong);
    color: var(--color-ink);
    padding: var(--spacing-sm) var(--spacing-lg);
  }
  .banner-title {
    display: block;
    font-weight: 700;
  }
  .banner-body {
    margin: 0;
    max-width: 80ch;
  }
  p {
    font-size: var(--font-size-small);
    line-height: 1.4;
  }
</style>
