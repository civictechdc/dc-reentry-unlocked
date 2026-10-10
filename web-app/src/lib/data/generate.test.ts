import { describe, expect, it } from 'vitest'
import { generateHousingPrograms } from './generate'
import { DC_BOUNDARY, inDCRectangle, pointInPolygon } from './geometry'
import { CSV_PROVIDER_NAMES, DC_ADDRESS_POOL } from './source-profile'
import type { HousingProgram, RentCostCategory, WardsServed } from '../types'
import {
  CLASSIFICATIONS,
  GENDERS_SERVED,
  HOUSEHOLD_TYPES,
  HOUSING_CATEGORIES,
  RENT_COST_CATEGORIES,
} from '../types'

/**
 * Every formatted address the generator may emit, derived from the embedded
 * pool exactly the way `generateHousingPrograms` formats it.
 */
const FORMATTED_ADDRESSES: ReadonlySet<string> = new Set(
  DC_ADDRESS_POOL.map((entry) => `${entry.addressLine}, ${entry.locality}, DC ${entry.postalCode}`),
)

/**
 * Coherence markers per rent category. Every template in the generator
 * satisfies its marker, so a match proves the text was drawn from the
 * category's template list.
 */
function rentTextMatchesCategory(category: RentCostCategory, text: string): boolean {
  switch (category) {
    case 'income-based':
      return /income/i.test(text)
    case 'subsidized-reduced':
      return /subsid|reduc/i.test(text)
    case 'free':
      return /^No |^Free/.test(text)
    case 'market-rate':
      return /market/i.test(text)
  }
}

function expectValidWardsServed(wards: WardsServed): void {
  if (wards[0] === 'citywide' || wards[0] === 'other-unknown') {
    // Citywide / unknown are always emitted alone, never with numeric wards.
    expect(wards).toHaveLength(1)
    return
  }
  expect(wards.length).toBeGreaterThanOrEqual(1)
  const seen = new Set<number>()
  for (const ward of wards) {
    expect(Number.isInteger(ward), `non-integer ward: ${String(ward)}`).toBe(true)
    expect(ward).toBeGreaterThanOrEqual(1)
    expect(ward).toBeLessThanOrEqual(8)
    expect(seen.has(ward), `duplicate ward: ${String(ward)}`).toBe(false)
    seen.add(ward)
  }
}

/** Assert every documented invariant on one generated record. */
function expectValidProgram(p: HousingProgram): void {
  expect(p.id).toMatch(/^p-\d{4}$/)
  expect(CSV_PROVIDER_NAMES).toContain(p.provider)
  expect(CLASSIFICATIONS).toContain(p.classification)

  expect(p.housingCategories.length).toBeGreaterThanOrEqual(1)
  expect(p.housingCategories.length).toBeLessThanOrEqual(3)
  const seenCategories = new Set<string>()
  for (const category of p.housingCategories) {
    expect(HOUSING_CATEGORIES).toContain(category)
    expect(seenCategories.has(category), `duplicate category: ${category}`).toBe(false)
    seenCategories.add(category)
  }

  expectValidWardsServed(p.wardsServed)

  expect(GENDERS_SERVED).toContain(p.genderServed)
  expect(HOUSEHOLD_TYPES).toContain(p.householdType)
  expect(RENT_COST_CATEGORIES).toContain(p.rentCostCategory)

  // Every record gets a category AND coherent non-null rent text.
  expect(p.rentCostText).not.toBeNull()
  expect(rentTextMatchesCategory(p.rentCostCategory, p.rentCostText as string)).toBe(true)

  expect(Number.isInteger(p.bedsUnits), `non-integer bedsUnits: ${p.bedsUnits}`).toBe(true)
  expect(p.bedsUnits).toBeGreaterThanOrEqual(1)
  expect(p.bedsUnitsText === `${p.bedsUnits} beds` || p.bedsUnitsText === `${p.bedsUnits} units`).toBe(true)

  if (p.populationServed !== null) {
    expect(typeof p.populationServed).toBe('string')
    expect(p.populationServed.length).toBeGreaterThan(0)
  }

  expect(FORMATTED_ADDRESSES.has(p.address), `address not from pool: ${p.address}`).toBe(true)

  expect(inDCRectangle(p.lat, p.lon), `outside rectangle: ${p.id}`).toBe(true)
  expect(pointInPolygon(p.lat, p.lon, DC_BOUNDARY), `outside polygon: ${p.id}`).toBe(true)

  // Contacts are never fabricated.
  expect(p.phone).toBeNull()
  expect(p.email).toBeNull()
  expect(p.website).toBeNull()
  expect(p.programUrl).toBeNull()

  expect(p.programName.length).toBeGreaterThan(0)
}

describe('generateHousingPrograms', () => {
  it('is deterministic: same seed, same output, even with interleaved calls', () => {
    const a = generateHousingPrograms(42)
    generateHousingPrograms(7, 3) // interleaved call with another seed
    const b = generateHousingPrograms(42)
    expect(a).toEqual(b)
  })

  it('produces different output for different seeds', () => {
    expect(generateHousingPrograms(42)).not.toEqual(generateHousingPrograms(43))
  })

  it('returns exactly `count` programs (default 75)', () => {
    expect(generateHousingPrograms(7, 10)).toHaveLength(10)
    expect(generateHousingPrograms(7, 1)).toHaveLength(1)
    expect(generateHousingPrograms(1)).toHaveLength(75)
  })

  it('throws RangeError for invalid counts', () => {
    for (const count of [0, -1, 1.5, Number.NaN, '5' as unknown as number]) {
      expect(() => generateHousingPrograms(1, count)).toThrow(RangeError)
    }
  })

  it('assigns unique, sequential ids in p-NNNN format', () => {
    const ids = generateHousingPrograms(5, 120).map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id, i) => {
      expect(id).toBe(`p-${String(i + 1).padStart(4, '0')}`)
    })
    expect(ids[0]).toBe('p-0001')
    expect(ids[119]).toBe('p-0120')
  })

  it('produces only valid programs per the type contract (default-size sample)', () => {
    for (const p of generateHousingPrograms(99, 75)) {
      expectValidProgram(p)
    }
  })

  it('produces only valid programs across a large sample covering every dimension', () => {
    for (const p of generateHousingPrograms(2026, 500)) {
      expectValidProgram(p)
    }
  })

  it('places every program inside the rectangle AND the D.C. polygon', () => {
    for (const p of generateHousingPrograms(123, 75)) {
      expect(inDCRectangle(p.lat, p.lon), `outside rectangle: ${p.id}`).toBe(true)
      expect(pointInPolygon(p.lat, p.lon, DC_BOUNDARY), `outside polygon: ${p.id}`).toBe(true)
    }
  })

  it('emits multi-category and multi-ward records for a chosen seed', () => {
    // Seed 42 verified offline: 16 multi-category and 10 multi-ward records
    // in the 75-record sample. Output is deterministic, so presence is stable.
    const programs = generateHousingPrograms(42, 75)
    expect(programs.some((p) => p.housingCategories.length >= 2)).toBe(true)
    expect(programs.some((p) => p.housingCategories.length === 3)).toBe(true)
    expect(
      programs.some(
        (p) => p.wardsServed[0] !== 'citywide' && p.wardsServed[0] !== 'other-unknown' && p.wardsServed.length >= 2,
      ),
    ).toBe(true)
  })

  it('covers all 4 rent categories and all 4 classifications in a large sample', () => {
    // NEEDS VERIFICATION carries weight 2 of 935 (~0.21%), far below one hit
    // in a 75-record sample, so this assertion uses a 500-record sample with
    // a seed verified to contain all four classifications (3 hits). Output
    // is deterministic, so the assertion is stable.
    const programs = generateHousingPrograms(2026, 500)
    expect(new Set(programs.map((p) => p.rentCostCategory))).toEqual(new Set(RENT_COST_CATEGORIES))
    expect(new Set(programs.map((p) => p.classification))).toEqual(new Set(CLASSIFICATIONS))
  })
})
