/**
 * Human-readable display labels for the domain enums, shared by the filter
 * panel, the table and the map popups. This module is the single source of
 * truth for option labels — components must import from here rather than
 * keeping their own copies, so the wording cannot drift apart.
 */

import type {
  Classification,
  GenderServed,
  HouseholdType,
  HousingCategory,
  HousingProgram,
  RentCostCategory,
  Ward,
  WardSelection,
  WardsServed,
} from './types'

/** Exhaustive label map; the compiler flags any missing enum member. */
export const CLASSIFICATION_LABELS: Readonly<Record<Classification, string>> = {
  'GENERAL HOUSING — REENTRY ACCESS POSSIBLE': 'General housing — reentry access possible',
  'VERIFIED REENTRY HOUSING': 'Verified reentry housing',
  'VERIFIED CRIMINAL-RECORD-FRIENDLY': 'Verified criminal-record-friendly',
  'NEEDS VERIFICATION': 'Needs verification',
}

/** Exhaustive label map; the compiler flags any missing enum member. */
export const HOUSING_CATEGORY_LABELS: Readonly<Record<HousingCategory, string>> = {
  'permanent-supportive': 'Permanent supportive',
  transitional: 'Transitional',
  'emergency-shelter': 'Emergency shelter',
  'affordable-rental': 'Affordable rental',
  'rapid-rehousing': 'Rapid rehousing',
  'recovery-sober': 'Recovery / sober',
  'rental-assistance': 'Rental assistance',
  'homelessness-prevention': 'Homelessness prevention',
  'housing-navigation': 'Housing navigation',
  'public-housing': 'Public housing',
  'market-rate': 'Market rate',
  sro: 'SRO',
  'other-unknown': 'Not listed / unknown',
}

/** Exhaustive label map; the compiler flags any missing enum member. */
export const GENDER_SERVED_LABELS: Readonly<Record<GenderServed, string>> = {
  men: 'Men',
  women: 'Women',
  'all-genders': 'All genders',
  'other-unknown': 'Not listed / unknown',
}

/** Exhaustive label map; the compiler flags any missing enum member. */
export const HOUSEHOLD_TYPE_LABELS: Readonly<Record<HouseholdType, string>> = {
  individuals: 'Individuals',
  families: 'Families',
  both: 'Individuals and families',
  'other-unknown': 'Not listed / unknown',
}

/** Exhaustive label map; the compiler flags any missing enum member. */
export const RENT_COST_CATEGORY_LABELS: Readonly<Record<RentCostCategory, string>> = {
  'income-based': 'Income based',
  'subsidized-reduced': 'Subsidized / reduced',
  free: 'Free',
  'market-rate': 'Market rate',
}

/** Label for a single ward-filter selection. */
export function wardLabel(ward: WardSelection): string {
  return ward === 'other-unknown' ? 'Not listed / unknown' : `Ward ${ward}`
}

/**
 * Service-area text for a program's ward coverage: `'Ward 3'` for a single
 * ward, `'Wards 5, 7'` for several, `'Citywide'`, or `'Not listed'` when
 * ward coverage is not publicly listed.
 */
export function formatWardsServed(wards: WardsServed): string {
  const first = wards[0]
  if (first === 'citywide') return 'Citywide'
  if (first === 'other-unknown') return 'Not listed'
  const wardNumbers = wards.filter((w): w is Ward => typeof w === 'number')
  return wardNumbers.length === 1 ? `Ward ${wardNumbers[0]}` : `Wards ${wardNumbers.join(', ')}`
}

/**
 * Vacant beds/units text: the parsed count, with the source text in
 * parentheses when publicly listed — e.g. `47 (47 units)` or just `47`.
 * The parsed count is always shown (it is the filterable value), even when
 * the source text is null.
 */
export function formatBedsUnits(
  program: Pick<HousingProgram, 'bedsUnits' | 'bedsUnitsText'>,
): string {
  return program.bedsUnitsText === null
    ? String(program.bedsUnits)
    : `${program.bedsUnits} (${program.bedsUnitsText})`
}
