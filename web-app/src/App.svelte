<script lang="ts">
  import CountBadge from './lib/components/CountBadge.svelte'
  import FilterPanel from './lib/components/FilterPanel.svelte'
  import MapView from './lib/components/MapView.svelte'
  import ProgramTable from './lib/components/ProgramTable.svelte'
  import { generateHousingPrograms } from './lib/data/generate'
  import { createHousingProgramState } from './lib/stores.svelte'

  /**
   * Fixed seed so every load produces the identical synthetic dataset —
   * the demo is deterministic across reloads, machines and runs.
   */
  const SEED = 2026
  const PROGRAM_COUNT = 75

  const state = createHousingProgramState(generateHousingPrograms(SEED, PROGRAM_COUNT))
</script>

<div class="app">
  <header class="app-header">
    <h1>DC Reentry Housing — Program Discovery (synthetic data)</h1>
    <CountBadge count={state.filteredPrograms.length} />
  </header>

  <!-- Persistent, non-dismissible disclaimer: always visible, never closable. -->
  <p class="notice">
    Synthetic housing-program examples using real provider names. Program details, locations, costs, and vacancies are simulated. Discovery only — not eligibility determination or verified availability.
  </p>

  <FilterPanel
    filters={state.filters}
    onchange={(f) => state.setFilters(f)}
    onreset={() => state.resetFilters()}
  />

  <main class="app-grid">
    <!-- One derived source of truth: the map and the table always receive the
         same filtered array, so marker count == row count == badge count. -->
    <MapView programs={state.filteredPrograms} />
    <ProgramTable programs={state.filteredPrograms} />
  </main>
</div>
