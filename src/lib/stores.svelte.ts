/**
 * Application state factory.
 *
 * One factory instance owns the single source of truth for the house list and
 * the filter state; `filteredHouses` is derived so the map and the table are
 * always fed by the same array. Exported as a factory (not rune bindings) so
 * each caller gets an independent, testable slice of state.
 */

import { applyFilters, defaultFilters, validateFilters } from './filters'
import type { FilterState } from './filters'
import type { House } from './types'

export function createHouseState(initialHouses: readonly House[]) {
  let houses = $state<House[]>([...initialHouses])
  let filters = $state<FilterState>(defaultFilters())

  const filteredHouses = $derived(applyFilters(houses, filters))

  return {
    get houses(): House[] {
      return houses
    },
    get filters(): FilterState {
      return filters
    },
    get filteredHouses(): House[] {
      return filteredHouses
    },

    /**
     * Commit a new filter state. Validates first: invalid input throws
     * RangeError and leaves the current state untouched.
     */
    setFilters(next: FilterState): void {
      const error = validateFilters(next)
      if (error !== null) {
        throw new RangeError(`Invalid filters: ${error}`)
      }
      filters = { ...next }
    },

    resetFilters(): void {
      filters = defaultFilters()
    },
  }
}
