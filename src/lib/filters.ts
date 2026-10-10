/**
 * House filtering.
 *
 * `applyFilters` is the single source of truth for what the map and the table
 * both display: one derived filtered array feeds both views, so the marker
 * count always equals the row count.
 *
 * All functions are pure: no input array or house object is ever mutated, and
 * the input order is preserved in the output.
 */

import type { House, HouseType } from './types'

export interface FilterState {
  /** Inclusive lower price bound in USD, or null for no bound. */
  minPrice: number | null
  /** Inclusive upper price bound in USD, or null for no bound. */
  maxPrice: number | null
  /** Inclusive minimum bedroom count (non-negative integer). */
  minBedrooms: number
  /** Exact house type to match, or 'all' for any type. */
  type: HouseType | 'all'
}

const HOUSE_TYPES: readonly HouseType[] = ['single-family', 'townhouse', 'condo']

/** The neutral filter state: everything passes. */
export function defaultFilters(): FilterState {
  return { minPrice: null, maxPrice: null, minBedrooms: 0, type: 'all' }
}

function isValidPriceBound(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0)
}

/**
 * Validate a filter state. Returns `null` when valid, otherwise a human
 * readable error message describing the first problem found.
 */
export function validateFilters(f: FilterState): string | null {
  if (!isValidPriceBound(f.minPrice)) {
    return 'minPrice must be null or a finite, non-negative number'
  }
  if (!isValidPriceBound(f.maxPrice)) {
    return 'maxPrice must be null or a finite, non-negative number'
  }
  if (!Number.isInteger(f.minBedrooms) || f.minBedrooms < 0) {
    return 'minBedrooms must be a non-negative integer'
  }
  if (f.type !== 'all' && !HOUSE_TYPES.includes(f.type)) {
    return `type must be 'all' or one of: ${HOUSE_TYPES.join(', ')}`
  }
  if (f.minPrice !== null && f.maxPrice !== null && f.minPrice > f.maxPrice) {
    return 'minPrice must not exceed maxPrice'
  }
  return null
}

/**
 * Filter houses by price (inclusive bounds), minimum bedrooms (inclusive) and
 * exact type, AND-combined. Preserves input order and mutates nothing.
 *
 * @throws RangeError when the filter state is invalid.
 */
export function applyFilters(houses: readonly House[], f: FilterState): House[] {
  const error = validateFilters(f)
  if (error !== null) {
    throw new RangeError(`Invalid filters: ${error}`)
  }

  return houses.filter((h) => {
    if (f.minPrice !== null && h.price < f.minPrice) return false
    if (f.maxPrice !== null && h.price > f.maxPrice) return false
    if (h.bedrooms < f.minBedrooms) return false
    if (f.type !== 'all' && h.type !== f.type) return false
    return true
  })
}
