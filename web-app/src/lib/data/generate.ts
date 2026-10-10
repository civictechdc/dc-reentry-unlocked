/**
 * Synthetic D.C. reentry-housing program generator.
 *
 * Determinism contract: a fresh, seeded Faker instance is created on every
 * call (no shared RNG state, no clock, no network), so
 * `generateHousingPrograms(seed, count)` always returns the exact same list
 * for the same arguments — including when calls are interleaved.
 *
 * Distributions: classification weights mirror the source CSV; gender,
 * household, ward, rent-cost and capacity distributions are demo-balanced
 * synthetic weights approved by the owner (see `source-profile.ts`). Every
 * record carries a rent-cost category with
 * coherent non-null text and a bed/unit capacity >= 1.
 *
 * Placement: candidates are drawn uniformly from the inclusive D.C.
 * rectangle and kept only when they also fall inside the D.C. boundary
 * polygon, so every generated point satisfies both constraints. Address
 * strings are sampled (with replacement) from the embedded real-DC address
 * pool; coordinates stay independent simulated points.
 */

import { Faker, base, en, en_US } from '@faker-js/faker'
import type {
  Classification,
  GenderServed,
  HouseholdType,
  HousingCategory,
  HousingProgram,
  NonEmptyReadonlyArray,
  RentCostCategory,
  Ward,
  WardsServed,
} from '../types'
import {
  CLASSIFICATIONS,
  GENDERS_SERVED,
  HOUSEHOLD_TYPES,
  HOUSING_CATEGORIES,
  RENT_COST_CATEGORIES,
} from '../types'
import {
  BEDS_UNITS_BUCKETS,
  BEDS_UNITS_BUCKET_WEIGHTS,
  CATEGORY_COUNT_WEIGHTS,
  CLASSIFICATION_WEIGHTS,
  CSV_PROVIDER_NAMES,
  DC_ADDRESS_POOL,
  GENDER_WEIGHTS,
  HOUSING_CATEGORY_WEIGHTS,
  HOUSEHOLD_WEIGHTS,
  MULTI_WARD_COUNT_WEIGHTS,
  POPULATION_SERVED_WEIGHTS,
  RENT_COST_WEIGHTS,
  SINGLE_WARD_WEIGHTS,
  WARD_SHAPE_WEIGHTS,
} from './source-profile'
import { DC_BOUNDARY, DC_RECTANGLE, pointInPolygon } from './geometry'

/** Default records per generator call. */
const DEFAULT_COUNT = 75

/** Draw an index from `weights` using the seeded faker stream. */
function weightedIndex(faker: Faker, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = faker.number.float({ min: 0, max: total })
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll < 0) return i
  }
  return weights.length - 1
}

/** Pick one value with probability proportional to `weights`. */
function weightedPick<T>(faker: Faker, values: readonly T[], weights: readonly number[]): T {
  return values[weightedIndex(faker, weights)]
}

/**
 * Sample `count` distinct values with probability proportional to `weights`
 * (weights renormalized over the remaining pool after each draw).
 */
function sampleDistinctWeighted<T>(
  faker: Faker,
  values: readonly T[],
  weights: readonly number[],
  count: number,
): T[] {
  if (count > values.length) {
    throw new RangeError(
      `sampleDistinctWeighted cannot draw ${count} distinct values from a pool of ${values.length}`,
    )
  }
  const pool: Array<readonly [T, number]> = values.map((value, i) => [value, weights[i]])
  const picked: T[] = []
  for (let n = 0; n < count; n++) {
    const total = pool.reduce((sum, [, weight]) => sum + weight, 0)
    let roll = faker.number.float({ min: 0, max: total })
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i][1]
      if (roll < 0) {
        index = i
        break
      }
    }
    picked.push(pool[index][0])
    pool.splice(index, 1)
  }
  return picked
}

/** Ward shapes that read as bed-based facilities (shelters, sober houses, SROs). */
const BEDS_CATEGORIES: readonly HousingCategory[] = ['emergency-shelter', 'recovery-sober', 'sro']

/** Coherent rent/cost phrasing per category; the generator varies wording. */
const RENT_COST_TEXT_TEMPLATES: Record<RentCostCategory, readonly string[]> = {
  'income-based': [
    'Residents pay 30% of income toward rent',
    'Rent is 30% of adjusted monthly income',
    'Tenant pays 30% of income; a subsidy covers the rest',
  ],
  'subsidized-reduced': [
    'Reduced rent through a housing subsidy',
    'Subsidized rent; residents pay a reduced portion',
    'Rent reduced by a project-based subsidy',
  ],
  free: ['No program cost', 'No cost to residents', 'Free of charge; no rent is required'],
  'market-rate': [
    'Market-rate rent set by the property',
    'Rents at market rate for the area',
    'Standard market-rate lease',
  ],
}

/** Synthetic population descriptions; ~15% of records get null instead. */
const POPULATION_TEMPLATES: readonly string[] = [
  'Single adults',
  'Families with children',
  'Seniors aged 62 and older',
  'Young adults ages 18 to 24',
  'Women in recovery',
  'Veterans and their families',
  'People living with disabilities',
  'Men reentering the community after incarceration',
  'Returning citizens and their families',
  'Individuals experiencing chronic homelessness',
]

/** Clearly synthetic program-name building blocks. */
const PROGRAM_NAME_PREFIXES: readonly string[] = [
  'Hope',
  'Unity',
  'Harbor',
  'Beacon',
  'Lantern',
  'Cedar',
  'Rivergate',
  'New Dawn',
  'Second Chance',
  'Pillar',
  'Cornerstone',
  'Meadowbrook',
  'Northstar',
  'Bluebird',
  'Keystone',
]
const PROGRAM_NAME_SUFFIXES: readonly string[] = [
  'Commons',
  'Bridge Housing',
  'House',
  'Residence',
  'Transitional Living',
  'Supportive Housing',
  'Community Housing',
  'Haven',
  'Housing Center',
  'Home',
]

/** Build a non-empty readonly tuple from a non-empty array. */
function toNonEmptyReadonly<T>(items: readonly T[]): NonEmptyReadonlyArray<T> {
  return [items[0], ...items.slice(1)]
}

function generateHousingCategories(faker: Faker): NonEmptyReadonlyArray<HousingCategory> {
  const count = weightedIndex(faker, CATEGORY_COUNT_WEIGHTS) + 1 // 1..3
  const picked = sampleDistinctWeighted(faker, HOUSING_CATEGORIES, HOUSING_CATEGORY_WEIGHTS, count)
  return toNonEmptyReadonly(picked)
}

function generateWardsServed(faker: Faker): WardsServed {
  const shape = weightedIndex(faker, WARD_SHAPE_WEIGHTS)
  if (shape === 2) return ['citywide'] as const
  if (shape === 3) return ['other-unknown'] as const
  if (shape === 0) {
    const ward = (weightedIndex(faker, SINGLE_WARD_WEIGHTS) + 1) as Ward
    return [ward] as const
  }
  const count = weightedIndex(faker, MULTI_WARD_COUNT_WEIGHTS) + 2 // 2..4
  const wards = sampleDistinctWeighted(
    faker,
    [1, 2, 3, 4, 5, 6, 7, 8] as const,
    [1, 1, 1, 1, 1, 1, 1, 1],
    count,
  )
  return toNonEmptyReadonly(wards.sort((a, b) => a - b))
}

function generateCapacity(
  faker: Faker,
  categories: readonly HousingCategory[],
): { bedsUnits: number; bedsUnitsText: string } {
  const bucket = BEDS_UNITS_BUCKETS[weightedIndex(faker, BEDS_UNITS_BUCKET_WEIGHTS)]
  const bedsUnits = faker.number.int({ min: bucket[0], max: bucket[1] })
  const unitWord = BEDS_CATEGORIES.includes(categories[0]) ? 'beds' : 'units'
  return { bedsUnits, bedsUnitsText: `${bedsUnits} ${unitWord}` }
}

/**
 * Generate `count` (default 75) synthetic housing programs.
 *
 * @throws RangeError when `count` is not a positive integer.
 */
export function generateHousingPrograms(seed: number, count: number = DEFAULT_COUNT): HousingProgram[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`count must be a positive integer, got ${count}`)
  }

  const faker = new Faker({ locale: [en_US, en, base] })
  faker.seed(seed)

  const programs: HousingProgram[] = []
  for (let i = 0; i < count; i++) {
    const classification: Classification = weightedPick(faker, CLASSIFICATIONS, CLASSIFICATION_WEIGHTS)
    const housingCategories = generateHousingCategories(faker)
    const wardsServed = generateWardsServed(faker)
    const genderServed: GenderServed = weightedPick(faker, GENDERS_SERVED, GENDER_WEIGHTS)
    const householdType: HouseholdType = weightedPick(faker, HOUSEHOLD_TYPES, HOUSEHOLD_WEIGHTS)
    const rentCostCategory: RentCostCategory = weightedPick(faker, RENT_COST_CATEGORIES, RENT_COST_WEIGHTS)
    const rentCostText = faker.helpers.arrayElement(RENT_COST_TEXT_TEMPLATES[rentCostCategory])
    const { bedsUnits, bedsUnitsText } = generateCapacity(faker, housingCategories)
    const populationServed =
      weightedIndex(faker, POPULATION_SERVED_WEIGHTS) === 0
        ? faker.helpers.arrayElement(POPULATION_TEMPLATES)
        : null
    const poolEntry = faker.helpers.arrayElement(DC_ADDRESS_POOL)
    const address = `${poolEntry.addressLine}, ${poolEntry.locality}, DC ${poolEntry.postalCode}`
    const programName = `${faker.helpers.arrayElement(PROGRAM_NAME_PREFIXES)} ${faker.helpers.arrayElement(PROGRAM_NAME_SUFFIXES)}`
    const provider = faker.helpers.arrayElement(CSV_PROVIDER_NAMES)

    // Rejection sampling: uniform inside the D.C. rectangle, kept only when
    // also inside the D.C. boundary polygon (existing logic, unchanged).
    let lat: number
    let lon: number
    do {
      lat = faker.number.float({ min: DC_RECTANGLE.latMin, max: DC_RECTANGLE.latMax })
      lon = faker.number.float({ min: DC_RECTANGLE.lonMin, max: DC_RECTANGLE.lonMax })
    } while (!pointInPolygon(lat, lon, DC_BOUNDARY))

    programs.push({
      id: `p-${String(i + 1).padStart(4, '0')}`,
      provider,
      programName,
      housingCategories,
      classification,
      wardsServed,
      genderServed,
      householdType,
      populationServed,
      rentCostText,
      rentCostCategory,
      bedsUnitsText,
      bedsUnits,
      address,
      lat,
      lon,
      // Contacts are never fabricated: no reachable phone/email/URLs.
      phone: null,
      email: null,
      website: null,
      programUrl: null,
    })
  }

  return programs
}
