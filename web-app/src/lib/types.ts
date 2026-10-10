/**
 * Domain contracts for D.C. reentry housing programs.
 *
 * `HousingProgram` is the single record shape shared by the map and the table
 * views; one derived filtered array feeds both so the marker count always
 * equals the row count.
 *
 * Every collection field is deeply readonly: records are treated as immutable
 * data throughout the app. Fields whose source value is not publicly listed
 * use `null` for free text and an explicit `'other-unknown'` enum member for
 * categorical dimensions, so filters can match "unknown" deliberately instead
 * of silently dropping records.
 */

/** Verification status of a program's reentry relevance. */
export type Classification =
  | 'GENERAL HOUSING — REENTRY ACCESS POSSIBLE'
  | 'VERIFIED REENTRY HOUSING'
  | 'VERIFIED CRIMINAL-RECORD-FRIENDLY'
  | 'NEEDS VERIFICATION'

/** Kind of housing a program provides. A record lists one or more. */
export type HousingCategory =
  | 'permanent-supportive'
  | 'transitional'
  | 'emergency-shelter'
  | 'affordable-rental'
  | 'rapid-rehousing'
  | 'recovery-sober'
  | 'rental-assistance'
  | 'homelessness-prevention'
  | 'housing-navigation'
  | 'public-housing'
  | 'market-rate'
  | 'sro'
  | 'other-unknown'

/** D.C. ward number, 1–8. */
export type Ward = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** A ward filter selection: a known ward or the explicit unknown bucket. */
export type WardSelection = Ward | 'other-unknown'

/** Non-empty readonly tuple: at least one element. */
export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]]

/**
 * Wards a program serves. Exactly one of:
 * - one or more numeric wards,
 * - the literal `['citywide']` (serves the whole city),
 * - the literal `['other-unknown']` (ward coverage not publicly listed).
 */
export type WardsServed =
  | NonEmptyReadonlyArray<Ward>
  | readonly ['citywide']
  | readonly ['other-unknown']

/** Gender eligibility of a program. */
export type GenderServed = 'men' | 'women' | 'all-genders' | 'other-unknown'

/** Household composition a program accepts. */
export type HouseholdType = 'individuals' | 'families' | 'both' | 'other-unknown'

/** Coarse rent/program-cost bucket. */
export type RentCostCategory = 'income-based' | 'subsidized-reduced' | 'free' | 'market-rate'

/** One reentry housing program record. */
export interface HousingProgram {
  /** Stable unique identifier, e.g. `p-0001`. */
  readonly id: string
  /** Providing organization, e.g. `So Others Might Eat (SOME)`. */
  readonly provider: string
  /** Program name, e.g. `Shalom House`. */
  readonly programName: string
  /** One or more housing categories; never empty. */
  readonly housingCategories: NonEmptyReadonlyArray<HousingCategory>
  /** Verification status. */
  readonly classification: Classification
  /** Ward coverage; see {@link WardsServed}. */
  readonly wardsServed: WardsServed
  /** Gender eligibility. */
  readonly genderServed: GenderServed
  /** Household composition. */
  readonly householdType: HouseholdType
  /** Free-text population description, or null when not publicly listed. */
  readonly populationServed: string | null
  /** Free-text rent/program cost, or null when not publicly listed. */
  readonly rentCostText: string | null
  /** Coarse rent/program-cost bucket. */
  readonly rentCostCategory: RentCostCategory
  /** Free-text bed/unit capacity, or null when not publicly listed. */
  readonly bedsUnitsText: string | null
  /** Parsed bed/unit capacity; 0 when unknown (still filterable). */
  readonly bedsUnits: number
  /** Street address including the city line, e.g. `…, Washington, DC`. */
  readonly address: string
  /** Latitude in decimal degrees (WGS 84). */
  readonly lat: number
  /** Longitude in decimal degrees (WGS 84). */
  readonly lon: number
  /** Phone number, or null when not publicly listed. */
  readonly phone: string | null
  /** Email address, or null when not publicly listed. */
  readonly email: string | null
  /** Organization website, or null when not publicly listed. */
  readonly website: string | null
  /** Program-specific webpage, or null when not publicly listed. */
  readonly programUrl: string | null
}

// ---------------------------------------------------------------------------
// Option lists (single source of truth for filter UIs and validation).
// ---------------------------------------------------------------------------

export const CLASSIFICATIONS: readonly Classification[] = [
  'GENERAL HOUSING — REENTRY ACCESS POSSIBLE',
  'VERIFIED REENTRY HOUSING',
  'VERIFIED CRIMINAL-RECORD-FRIENDLY',
  'NEEDS VERIFICATION',
] as const

export const HOUSING_CATEGORIES: readonly HousingCategory[] = [
  'permanent-supportive',
  'transitional',
  'emergency-shelter',
  'affordable-rental',
  'rapid-rehousing',
  'recovery-sober',
  'rental-assistance',
  'homelessness-prevention',
  'housing-navigation',
  'public-housing',
  'market-rate',
  'sro',
  'other-unknown',
] as const

/** Ward filter options: wards 1–8 plus the explicit unknown bucket. */
export const WARD_SELECTIONS: readonly WardSelection[] = [1, 2, 3, 4, 5, 6, 7, 8, 'other-unknown'] as const

export const GENDERS_SERVED: readonly GenderServed[] = [
  'men',
  'women',
  'all-genders',
  'other-unknown',
] as const

export const HOUSEHOLD_TYPES: readonly HouseholdType[] = [
  'individuals',
  'families',
  'both',
  'other-unknown',
] as const

export const RENT_COST_CATEGORIES: readonly RentCostCategory[] = [
  'income-based',
  'subsidized-reduced',
  'free',
  'market-rate',
] as const
