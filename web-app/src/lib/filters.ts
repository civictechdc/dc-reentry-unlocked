/**
 * Housing-program filtering.
 *
 * `applyFilters` is the single source of truth for what the map and the table
 * both display: one derived filtered array feeds both views, so the marker
 * count always equals the row count.
 *
 * All functions are pure: no input array or program object is ever mutated,
 * and the input order is preserved in the output.
 *
 * Matching semantics: dimensions combine with AND; values within one
 * dimension combine with OR; an empty selection means "unrestricted" for that
 * dimension.
 */

import type {
  Classification,
  GenderServed,
  HouseholdType,
  HousingCategory,
  HousingProgram,
  RentCostCategory,
  WardSelection,
} from './types'
import {
  CLASSIFICATIONS,
  GENDERS_SERVED,
  HOUSEHOLD_TYPES,
  HOUSING_CATEGORIES,
  RENT_COST_CATEGORIES,
  WARD_SELECTIONS,
} from './types'

/** Complete filter state. Every selection is a set of accepted values. */
export interface FilterState {
  readonly classifications: readonly Classification[]
  readonly housingCategories: readonly HousingCategory[]
  readonly wards: readonly WardSelection[]
  readonly gendersServed: readonly GenderServed[]
  readonly householdTypes: readonly HouseholdType[]
  readonly rentCostCategories: readonly RentCostCategory[]
  /** Case-insensitive literal substring across provider, program name and population. */
  readonly searchText: string
  /** Inclusive minimum bed/unit count, or null for no bound. 0 is active. */
  readonly minBedsUnits: number | null
}

/** The neutral filter state: everything passes. */
export function defaultFilters(): FilterState {
  return {
    classifications: [],
    housingCategories: [],
    wards: [],
    gendersServed: [],
    householdTypes: [],
    rentCostCategories: [],
    searchText: '',
    minBedsUnits: null,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEnumArray(value: unknown, allowed: readonly unknown[], label: string): string | null {
  if (!Array.isArray(value)) {
    return `${label} must be an array`
  }
  const seen = new Set<unknown>()
  for (const entry of value) {
    if (!allowed.includes(entry)) {
      return `${label} contains an invalid value: ${String(entry)}`
    }
    if (seen.has(entry)) {
      return `${label} contains a duplicate value: ${String(entry)}`
    }
    seen.add(entry)
  }
  return null
}

function isValidWardSelection(entry: unknown): boolean {
  if (entry === 'other-unknown') return true
  return typeof entry === 'number' && Number.isInteger(entry) && entry >= 1 && entry <= 8
}

function isValidMinBedsUnits(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
}

/**
 * Validate an unknown runtime value as a filter state. Returns `null` when
 * valid, otherwise a human-readable message describing the first problem
 * found. Never throws on malformed input — hostile getters, throwing
 * Proxies, and other exotic objects surface as a validation error string.
 */
export function validateFilters(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return 'filters must be an object'
  }
  try {
    return inspectFilters(value as Record<string, unknown>)
  } catch {
    // Property access or iteration threw (e.g. a getter or Proxy trap).
    // The contract is "never throws", so degrade to a validation error.
    return 'filters could not be inspected'
  }
}

/** The inspection body of `validateFilters`; may throw on hostile inputs. */
function inspectFilters(f: Record<string, unknown>): string | null {
  const required: readonly (keyof FilterState)[] = [
    'classifications',
    'housingCategories',
    'wards',
    'gendersServed',
    'householdTypes',
    'rentCostCategories',
    'searchText',
    'minBedsUnits',
  ]
  for (const field of required) {
    // Own-property check: inherited properties (e.g. via Object.create or a
    // prototype chain) must not count as supplied filter fields.
    if (!Object.hasOwn(f, field)) {
      return `${field} is missing`
    }
  }

  let error = isEnumArray(f.classifications, CLASSIFICATIONS, 'classifications')
  if (error) return error
  error = isEnumArray(f.housingCategories, HOUSING_CATEGORIES, 'housingCategories')
  if (error) return error

  if (!Array.isArray(f.wards)) {
    return 'wards must be an array'
  }
  const seenWards = new Set<unknown>()
  for (const entry of f.wards) {
    if (!isValidWardSelection(entry)) {
      return `wards contains an invalid value: ${String(entry)}`
    }
    if (seenWards.has(entry)) {
      return `wards contains a duplicate value: ${String(entry)}`
    }
    seenWards.add(entry)
  }

  error = isEnumArray(f.gendersServed, GENDERS_SERVED, 'gendersServed')
  if (error) return error
  error = isEnumArray(f.householdTypes, HOUSEHOLD_TYPES, 'householdTypes')
  if (error) return error
  error = isEnumArray(f.rentCostCategories, RENT_COST_CATEGORIES, 'rentCostCategories')
  if (error) return error

  if (typeof f.searchText !== 'string') {
    return 'searchText must be a string'
  }
  if (!isValidMinBedsUnits(f.minBedsUnits)) {
    return 'minBedsUnits must be null or a non-negative integer'
  }
  return null
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function matchesClassification(p: HousingProgram, selected: readonly Classification[]): boolean {
  return selected.length === 0 || selected.includes(p.classification)
}

function matchesHousingCategories(p: HousingProgram, selected: readonly HousingCategory[]): boolean {
  if (selected.length === 0) return true
  return selected.some((c) => p.housingCategories.includes(c))
}

function matchesWards(p: HousingProgram, selected: readonly WardSelection[]): boolean {
  if (selected.length === 0) return true
  const wards = p.wardsServed
  if (wards[0] === 'citywide') {
    // Citywide matches any selection that contains at least one numeric ward.
    return selected.some((w) => w !== 'other-unknown')
  }
  if (wards[0] === 'other-unknown') {
    return selected.includes('other-unknown')
  }
  // Numeric ward list: matches a selection sharing at least one numeric ward.
  // A numeric record never matches an 'other-unknown' selection.
  return selected.some((w) => w !== 'other-unknown' && wards.includes(w))
}

function matchesGender(p: HousingProgram, selected: readonly GenderServed[]): boolean {
  if (selected.length === 0) return true
  switch (p.genderServed) {
    case 'all-genders':
      // all-genders records also match men/women selections.
      return selected.some((g) => g === 'all-genders' || g === 'men' || g === 'women')
    default:
      return selected.includes(p.genderServed)
  }
}

function matchesHousehold(p: HousingProgram, selected: readonly HouseholdType[]): boolean {
  if (selected.length === 0) return true
  switch (p.householdType) {
    case 'both':
      // 'both' records also match individuals/families selections.
      return selected.some((h) => h === 'both' || h === 'individuals' || h === 'families')
    default:
      return selected.includes(p.householdType)
  }
}

function matchesSearch(p: HousingProgram, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  if (p.provider.toLowerCase().includes(needle)) return true
  if (p.programName.toLowerCase().includes(needle)) return true
  if (p.populationServed !== null && p.populationServed.toLowerCase().includes(needle)) return true
  return false
}

function matchesRentCost(p: HousingProgram, selected: readonly RentCostCategory[]): boolean {
  return selected.length === 0 || selected.includes(p.rentCostCategory)
}

function matchesMinBedsUnits(p: HousingProgram, min: number | null): boolean {
  return min === null || p.bedsUnits >= min
}

/**
 * Filter programs by every dimension, AND-combined across dimensions and
 * OR-combined within each. Preserves input order, emits each matching record
 * exactly once, and mutates nothing.
 *
 * @throws RangeError when the filter state is invalid.
 */
export function applyFilters(programs: readonly HousingProgram[], filters: FilterState): HousingProgram[] {
  const error = validateFilters(filters)
  if (error !== null) {
    throw new RangeError(`Invalid filters: ${error}`)
  }

  return programs.filter(
    (p) =>
      matchesClassification(p, filters.classifications) &&
      matchesHousingCategories(p, filters.housingCategories) &&
      matchesWards(p, filters.wards) &&
      matchesGender(p, filters.gendersServed) &&
      matchesHousehold(p, filters.householdTypes) &&
      matchesSearch(p, filters.searchText) &&
      matchesRentCost(p, filters.rentCostCategories) &&
      matchesMinBedsUnits(p, filters.minBedsUnits),
  )
}
