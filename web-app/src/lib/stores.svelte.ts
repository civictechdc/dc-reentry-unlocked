/**
 * Application state factory.
 *
 * One factory instance owns the single source of truth for the housing-program
 * list and the filter state; `filteredPrograms` is derived so the map and the
 * table are always fed by the same array. Exported as a factory (not rune
 * bindings) so each caller gets an independent, testable slice of state.
 *
 * Exposed state is read-only from the component's perspective: the returned
 * object exposes getters only, so callers can observe but never reassign the
 * underlying state. Committed filter state never aliases caller-owned arrays —
 * `setFilters` deep-copies every selection array before committing.
 */

import { applyFilters, defaultFilters, validateFilters } from './filters'
import type { FilterState } from './filters'
import type { HousingProgram } from './types'

export function createHousingProgramState(initialPrograms: readonly HousingProgram[]) {
  let programs = $state<HousingProgram[]>([...initialPrograms])
  let filters = $state<FilterState>(defaultFilters())

  const filteredPrograms = $derived(applyFilters(programs, filters))

  return {
    get programs(): readonly HousingProgram[] {
      return programs
    },
    get filters(): FilterState {
      return filters
    },
    get filteredPrograms(): readonly HousingProgram[] {
      return filteredPrograms
    },

    /**
     * Commit a new filter state. Validates first: invalid input throws
     * RangeError and leaves the current state untouched. On success the outer
     * object and every selection array are copied, so later mutation of the
     * caller's arrays cannot change committed state.
     */
    setFilters(next: FilterState): void {
      const error = validateFilters(next)
      if (error !== null) {
        throw new RangeError(`Invalid filters: ${error}`)
      }
      filters = {
        classifications: [...next.classifications],
        housingCategories: [...next.housingCategories],
        wards: [...next.wards],
        gendersServed: [...next.gendersServed],
        householdTypes: [...next.householdTypes],
        rentCostCategories: [...next.rentCostCategories],
        searchText: next.searchText,
        minBedsUnits: next.minBedsUnits,
      }
    },

    resetFilters(): void {
      filters = defaultFilters()
    },
  }
}
