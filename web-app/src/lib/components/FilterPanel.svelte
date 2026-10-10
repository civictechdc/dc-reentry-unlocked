<script lang="ts">
  import { untrack } from 'svelte'
  import { defaultFilters, validateFilters } from '../filters'
  import type { FilterState } from '../filters'
  import type {
    Classification,
    GenderServed,
    HouseholdType,
    HousingCategory,
    RentCostCategory,
    WardSelection,
  } from '../types'
  import {
    CLASSIFICATIONS,
    GENDERS_SERVED,
    HOUSEHOLD_TYPES,
    HOUSING_CATEGORIES,
    RENT_COST_CATEGORIES,
    WARD_SELECTIONS,
  } from '../types'
  // Option labels come from the shared labels module so the panel can never
  // drift apart from the table and map popups.
  import {
    CLASSIFICATION_LABELS,
    GENDER_SERVED_LABELS,
    HOUSING_CATEGORY_LABELS,
    HOUSEHOLD_TYPE_LABELS,
    RENT_COST_CATEGORY_LABELS,
    wardLabel,
  } from '../labels'

  let {
    filters,
    onchange,
    onreset,
  }: {
    filters: FilterState
    onchange: (f: FilterState) => void
    onreset: () => void
  } = $props()

  // ---------------------------------------------------------------------------
  // Draft state
  // ---------------------------------------------------------------------------

  /**
   * Local draft, synced from the committed `filters` prop. Commits are
   * all-or-nothing: the whole draft is validated before `onchange` fires, and
   * an invalid draft keeps the previously committed filters in effect.
   */
  interface FilterDraft {
    classifications: Classification[]
    housingCategories: HousingCategory[]
    wards: WardSelection[]
    gendersServed: GenderServed[]
    householdTypes: HouseholdType[]
    rentCostCategories: RentCostCategory[]
    searchText: string
    /**
     * Svelte's number-input binding yields `null` for an empty field and
     * `NaN` for unparseable text (and `undefined` on some versions); real
     * browsers additionally flag bad text via the element's `badInput`.
     */
    minBeds: number | null | undefined
  }

  function draftFrom(f: FilterState): FilterDraft {
    return {
      classifications: [...f.classifications],
      housingCategories: [...f.housingCategories],
      wards: [...f.wards],
      gendersServed: [...f.gendersServed],
      householdTypes: [...f.householdTypes],
      rentCostCategories: [...f.rentCostCategories],
      searchText: f.searchText,
      minBeds: f.minBedsUnits,
    }
  }

  // The initializer deliberately captures the initial prop value; the $effect
  // below owns every subsequent sync (untrack silences the
  // state_referenced_locally warning for that intentional capture).
  let draft = $state<FilterDraft>(draftFrom(untrack(() => filters)))
  let error = $state<string | null>(null)
  let bedsInput = $state<HTMLInputElement | undefined>(undefined)

  // Keep drafts in sync whenever the committed filters change (initial mount,
  // valid commits echoed back by the parent, and resets).
  $effect(() => {
    draft = draftFrom(filters)
    error = null
  })

  // ---------------------------------------------------------------------------
  // Draft mutation + commit
  // ---------------------------------------------------------------------------

  function toggled<T>(list: readonly T[], value: T, checked: boolean): T[] {
    return checked ? [...list, value] : list.filter((v) => v !== value)
  }

  // Every checkbox handler reads the toggled state from the event
  // (`currentTarget.checked`) instead of bound state, which can be stale
  // inside a change handler — the newly toggled value is therefore always
  // part of the committed draft.

  function toggleClassification(value: Classification, checked: boolean): void {
    draft.classifications = toggled(draft.classifications, value, checked)
    commit()
  }

  function toggleHousingCategory(value: HousingCategory, checked: boolean): void {
    draft.housingCategories = toggled(draft.housingCategories, value, checked)
    commit()
  }

  function toggleWard(value: WardSelection, checked: boolean): void {
    draft.wards = toggled(draft.wards, value, checked)
    commit()
  }

  function toggleGenderServed(value: GenderServed, checked: boolean): void {
    draft.gendersServed = toggled(draft.gendersServed, value, checked)
    commit()
  }

  function toggleHouseholdType(value: HouseholdType, checked: boolean): void {
    draft.householdTypes = toggled(draft.householdTypes, value, checked)
    commit()
  }

  function toggleRentCostCategory(value: RentCostCategory, checked: boolean): void {
    draft.rentCostCategories = toggled(draft.rentCostCategories, value, checked)
    commit()
  }

  /** Convenience: an empty ward selection already means "unrestricted". */
  function clearWards(): void {
    draft.wards = []
    commit()
  }

  const BEDS_ERROR = 'Minimum beds / units must be empty or a whole number of at least 1.'

  /**
   * Resolve the beds draft. Empty (or null/undefined from the number
   * binding) means "no minimum" — unless the element reports `badInput`,
   * which is how real browsers surface unparseable text in a number field.
   * Anything else must be a whole number of at least 1, so garbage never
   * silently becomes "unrestricted".
   *
   * Intentional divergence from the library contract: `filters.ts` accepts
   * `minBedsUnits: 0` as valid, but this UI rejects it (input `min="1"`
   * and the `value < 1` check below). 0 is semantically identical to
   * "no minimum" — every record has at least 0 beds/units — so offering it
   * would only add a redundant state; users leave the field empty instead.
   */
  function parseMinBeds(): { ok: true; value: number | null } | { ok: false; message: string } {
    const value = draft.minBeds
    if (value === undefined || value === null) {
      if (bedsInput !== undefined && bedsInput.validity.badInput) {
        return { ok: false, message: BEDS_ERROR }
      }
      return { ok: true, value: null }
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      return { ok: false, message: BEDS_ERROR }
    }
    return { ok: true, value }
  }

  /**
   * Validate the whole draft; commit on success, surface an error otherwise.
   *
   * Deliberately all-or-nothing: while any part of the draft is invalid
   * nothing commits — the previously committed filters stay in effect until
   * the draft becomes valid (on blur/Enter/next toggle).
   */
  function commit(): void {
    const beds = parseMinBeds()
    if (!beds.ok) {
      error = beds.message
      return
    }
    const candidate: FilterState = {
      classifications: [...draft.classifications],
      housingCategories: [...draft.housingCategories],
      wards: [...draft.wards],
      gendersServed: [...draft.gendersServed],
      householdTypes: [...draft.householdTypes],
      rentCostCategories: [...draft.rentCostCategories],
      searchText: draft.searchText,
      minBedsUnits: beds.value,
    }
    const problem = validateFilters(candidate)
    if (problem !== null) {
      error = problem
      return
    }
    error = null
    onchange(candidate)
  }

  function handleReset(): void {
    draft = draftFrom(defaultFilters())
    error = null
    onreset()
  }
</script>

<form class="filter-panel" onsubmit={(e) => e.preventDefault()}>
  {#if error !== null}
    <p class="filter-error" role="alert" id="filter-error">{error}</p>
  {/if}

  <fieldset class="filter-group">
    <legend>Classification</legend>
    {#each CLASSIFICATIONS as option (option)}
      <label class="filter-option">
        <input
          type="checkbox"
          name="filter-classification"
          checked={draft.classifications.includes(option)}
          onchange={(e) => toggleClassification(option, e.currentTarget.checked)}
        />
        {CLASSIFICATION_LABELS[option]}
      </label>
    {/each}
  </fieldset>

  <fieldset class="filter-group">
    <legend>Housing category</legend>
    {#each HOUSING_CATEGORIES as option (option)}
      <label class="filter-option">
        <input
          type="checkbox"
          name="filter-housing-category"
          checked={draft.housingCategories.includes(option)}
          onchange={(e) => toggleHousingCategory(option, e.currentTarget.checked)}
        />
        {HOUSING_CATEGORY_LABELS[option]}
      </label>
    {/each}
  </fieldset>

  <fieldset class="filter-group">
    <legend>Ward</legend>
    {#each WARD_SELECTIONS as ward (ward)}
      <label class="filter-option">
        <input
          type="checkbox"
          name="filter-ward"
          checked={draft.wards.includes(ward)}
          onchange={(e) => toggleWard(ward, e.currentTarget.checked)}
        />
        {wardLabel(ward)}
      </label>
    {/each}
    <button type="button" class="filter-clear" onclick={clearWards}>Clear wards</button>
  </fieldset>

  <fieldset class="filter-group">
    <legend>Gender served</legend>
    {#each GENDERS_SERVED as option (option)}
      <label class="filter-option">
        <input
          type="checkbox"
          name="filter-gender"
          checked={draft.gendersServed.includes(option)}
          onchange={(e) => toggleGenderServed(option, e.currentTarget.checked)}
        />
        {GENDER_SERVED_LABELS[option]}
      </label>
    {/each}
  </fieldset>

  <fieldset class="filter-group">
    <legend>Household type</legend>
    {#each HOUSEHOLD_TYPES as option (option)}
      <label class="filter-option">
        <input
          type="checkbox"
          name="filter-household"
          checked={draft.householdTypes.includes(option)}
          onchange={(e) => toggleHouseholdType(option, e.currentTarget.checked)}
        />
        {HOUSEHOLD_TYPE_LABELS[option]}
      </label>
    {/each}
  </fieldset>

  <fieldset class="filter-group">
    <legend>Rent / program cost</legend>
    {#each RENT_COST_CATEGORIES as option (option)}
      <label class="filter-option">
        <input
          type="checkbox"
          name="filter-rent-cost"
          checked={draft.rentCostCategories.includes(option)}
          onchange={(e) => toggleRentCostCategory(option, e.currentTarget.checked)}
        />
        {RENT_COST_CATEGORY_LABELS[option]}
      </label>
    {/each}
  </fieldset>

  <div class="filter-field">
    <label for="filter-search">Search programs</label>
    <input
      id="filter-search"
      type="search"
      placeholder="Provider, program, or population"
      bind:value={draft.searchText}
      onchange={commit}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
    />
  </div>

  <div class="filter-field">
    <label for="filter-min-beds">Minimum beds / units</label>
    <input
      id="filter-min-beds"
      type="number"
      min="1"
      step="1"
      placeholder="No minimum"
      bind:value={draft.minBeds}
      bind:this={bedsInput}
      onchange={commit}
      aria-invalid={error !== null}
      aria-describedby={error !== null ? 'filter-error' : undefined}
    />
  </div>

  <button type="button" onclick={handleReset}>Reset filters</button>
</form>

<style>
  /* Checkbox groups: reset default fieldset chrome; legend shares the
     panel's label typography. */
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    border: none;
    min-width: 150px;
  }

  .filter-group legend {
    padding: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .filter-option {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
  }

  .filter-clear {
    align-self: flex-start;
    margin-top: 4px;
    padding: 2px 8px;
    font-size: 0.75rem;
  }
</style>
