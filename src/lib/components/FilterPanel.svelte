<script lang="ts">
  import { validateFilters } from '../filters'
  import type { FilterState } from '../filters'

  let {
    filters,
    onchange,
    onreset,
  }: {
    filters: FilterState
    onchange: (f: FilterState) => void
    onreset: () => void
  } = $props()

  // Draft input state, kept separate from the committed `filters` prop.
  // Svelte's number-input binding yields `number | null` (empty → null), and
  // the initial/effect sync writes strings, so drafts are `string | number | null`.
  let minPriceText = $state<string | number | null>('')
  let maxPriceText = $state<string | number | null>('')
  let minBedroomsText = $state<string | number | null>('0')
  let type = $state<FilterState['type']>('all')
  let error = $state<string | null>(null)

  // Keep drafts in sync whenever the committed filters change (initial mount,
  // valid commits echoed back by the parent, and resets).
  $effect(() => {
    minPriceText = filters.minPrice === null ? '' : String(filters.minPrice)
    maxPriceText = filters.maxPrice === null ? '' : String(filters.maxPrice)
    minBedroomsText = String(filters.minBedrooms)
    type = filters.type
    error = null
  })

  /** Empty (or null from the number binding) means "no bound". */
  function parsePrice(value: string | number | null): number | null {
    if (value === null || value === '') return null
    return typeof value === 'number' ? value : Number(value.trim())
  }

  /** Empty means the default of 0 bedrooms. */
  function parseBedrooms(value: string | number | null): number {
    if (value === null || value === '') return 0
    return typeof value === 'number' ? value : Number(value.trim())
  }

  function draft(): FilterState {
    return {
      minPrice: parsePrice(minPriceText),
      maxPrice: parsePrice(maxPriceText),
      minBedrooms: parseBedrooms(minBedroomsText),
      type,
    }
  }

  /**
   * Validate the draft; commit on success, surface an error otherwise.
   *
   * Deliberately all-or-nothing: the draft is validated as a whole, and while
   * any field is invalid nothing commits — the previously committed filters
   * stay in effect until the draft becomes valid (on blur/Enter). This avoids
   * committing half-typed values like `-` or `2.` and keeps the map/table in
   * sync with a single consistent filter state.
   */
  function commit(): void {
    const candidate = draft()
    const problem = validateFilters(candidate)
    if (problem !== null) {
      error = problem
      return
    }
    error = null
    onchange(candidate)
  }

  function handleReset(): void {
    error = null
    minPriceText = ''
    maxPriceText = ''
    minBedroomsText = '0'
    type = 'all'
    onreset()
  }
</script>

<form class="filter-panel" onsubmit={(e) => e.preventDefault()}>
  {#if error !== null}
    <p class="filter-error" role="alert" id="filter-error">{error}</p>
  {/if}

  <div class="filter-field">
    <label for="min-price">Min price</label>
    <input
      id="min-price"
      type="number"
      min="0"
      step="1"
      placeholder="No minimum"
      bind:value={minPriceText}
      onchange={commit}
      aria-invalid={error !== null}
      aria-describedby={error !== null ? 'filter-error' : undefined}
    />
  </div>

  <div class="filter-field">
    <label for="max-price">Max price</label>
    <input
      id="max-price"
      type="number"
      min="0"
      step="1"
      placeholder="No maximum"
      bind:value={maxPriceText}
      onchange={commit}
      aria-invalid={error !== null}
      aria-describedby={error !== null ? 'filter-error' : undefined}
    />
  </div>

  <div class="filter-field">
    <label for="min-bedrooms">Min bedrooms</label>
    <input
      id="min-bedrooms"
      type="number"
      min="0"
      step="1"
      bind:value={minBedroomsText}
      onchange={commit}
      aria-invalid={error !== null}
      aria-describedby={error !== null ? 'filter-error' : undefined}
    />
  </div>

  <div class="filter-field">
    <label for="property-type">Property type</label>
    <select
      id="property-type"
      bind:value={type}
      onchange={commit}
      aria-invalid={error !== null}
      aria-describedby={error !== null ? 'filter-error' : undefined}
    >
      <option value="all">All types</option>
      <option value="single-family">Single-family</option>
      <option value="townhouse">Townhouse</option>
      <option value="condo">Condo</option>
    </select>
  </div>

  <button type="button" onclick={handleReset}>Reset filters</button>
</form>
