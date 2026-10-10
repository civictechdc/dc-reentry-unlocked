<script lang="ts">
  let { count }: { count: number } = $props()
</script>

<p class="count-badge" aria-live="polite">{count} {count === 1 ? 'program' : 'programs'}</p>
