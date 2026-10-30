<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";
  import { m } from "#lib/paraglide/messages.js";
  import DisclosureBanner from "#lib/components/DisclosureBanner.svelte";

  const { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>{m.app_title()}</title>
</svelte:head>
<a class="skip-link" href="#app-main">{m.app_heading()}</a>
<DisclosureBanner />
<header class="app-header">
  <h1 class="app-title">{m.app_heading()}</h1>
</header>
<main id="app-main">
  {@render children()}
</main>

<style>
  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
    background: var(--surface-raised);
    color: var(--ink);
    padding: 0.5rem 1rem;
    z-index: 100;
  }
  .skip-link:focus-visible {
    left: 0;
  }
  .app-header {
    background: var(--surface-raised);
    border-bottom: 1px solid var(--line);
    padding: 0.5rem 1rem;
  }
  .app-title {
    font-size: 1.125rem;
    margin: 0;
    color: var(--ink);
  }
  main {
    padding: 0;
  }
</style>
