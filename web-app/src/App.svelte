<script lang="ts">
  import CountBadge from './lib/components/CountBadge.svelte'
  import FilterPanel from './lib/components/FilterPanel.svelte'
  import HouseTable from './lib/components/HouseTable.svelte'
  import MapView from './lib/components/MapView.svelte'
  import { generateHouses } from './lib/data/generate'
  import { createHouseState } from './lib/stores.svelte'

  const state = createHouseState(generateHouses(42))
</script>

<div class="app">
  <header class="app-header">
    <h1>D.C. Reentry Unlocked — Housing Finder</h1>
    <p class="notice">Synthetic sample data — not real listings.</p>
    <CountBadge count={state.filteredHouses.length} />
  </header>

  <FilterPanel
    filters={state.filters}
    onchange={(f) => state.setFilters(f)}
    onreset={() => state.resetFilters()}
  />

  <main class="app-grid">
    <MapView houses={state.filteredHouses} />
    <HouseTable houses={state.filteredHouses} />
  </main>
</div>
