<script lang="ts">
  // Test-only harness for the route-level suites: mounts the real root
  // layout with the real page as its children snippet — the exact
  // production composition. A snippet prop cannot be constructed outside a
  // component boundary, so this wrapper exists to pass the page as the
  // layout's children.
  import Layout from "./+layout.svelte";
  import Page from "./+page.svelte";
</script>

<Layout>
  <Page />
</Layout>
