import { describe, expect, it } from 'vitest'
import type { House } from './types'
import { applyFilters, defaultFilters, validateFilters } from './filters'
import type { FilterState } from './filters'

function house(overrides: Partial<House> = {}): House {
  return {
    id: 'h-0001',
    address: '1 Test St, Washington, DC',
    lat: 38.9,
    lon: -77.0,
    price: 500_000,
    bedrooms: 2,
    bathrooms: 1.5,
    sqft: 1000,
    type: 'townhouse',
    ...overrides,
  }
}

function houses(): House[] {
  return [
    house({ id: 'h-0001', price: 200_000, bedrooms: 1, type: 'condo' }),
    house({ id: 'h-0002', price: 500_000, bedrooms: 3, type: 'townhouse' }),
    house({ id: 'h-0003', price: 1_000_000, bedrooms: 4, type: 'single-family' }),
    house({ id: 'h-0004', price: 2_500_000, bedrooms: 6, type: 'single-family' }),
  ]
}

const ALL: FilterState = { minPrice: null, maxPrice: null, minBedrooms: 0, type: 'all' }

describe('filters', () => {
  it('defaultFilters is neutral: every house passes', () => {
    expect(defaultFilters()).toEqual(ALL)
    expect(applyFilters(houses(), defaultFilters()).map((h) => h.id)).toEqual([
      'h-0001',
      'h-0002',
      'h-0003',
      'h-0004',
    ])
  })

  it('price bounds are inclusive', () => {
    const result = applyFilters(houses(), { ...ALL, minPrice: 500_000, maxPrice: 1_000_000 })
    expect(result.map((h) => h.id)).toEqual(['h-0002', 'h-0003'])
  })

  it('minBedrooms is inclusive', () => {
    expect(applyFilters(houses(), { ...ALL, minBedrooms: 3 }).map((h) => h.id)).toEqual([
      'h-0002',
      'h-0003',
      'h-0004',
    ])
  })

  it('matches the exact house type', () => {
    expect(applyFilters(houses(), { ...ALL, type: 'single-family' }).map((h) => h.id)).toEqual([
      'h-0003',
      'h-0004',
    ])
  })

  it('combines criteria with AND', () => {
    const f: FilterState = { minPrice: 400_000, maxPrice: 1_500_000, minBedrooms: 4, type: 'all' }
    expect(applyFilters(houses(), f).map((h) => h.id)).toEqual(['h-0003'])
  })

  it('can produce zero results', () => {
    expect(applyFilters(houses(), { ...ALL, minPrice: 10_000_000 })).toEqual([])
  })

  it('preserves input order', () => {
    expect(applyFilters(houses(), { ...ALL, minBedrooms: 1 }).map((h) => h.id)).toEqual([
      'h-0001',
      'h-0002',
      'h-0003',
      'h-0004',
    ])
  })

  it('does not mutate the input array or the houses', () => {
    const frozen = houses().map((h) => Object.freeze(h)) as House[]
    Object.freeze(frozen)
    const f: FilterState = { minPrice: 400_000, maxPrice: 900_000, minBedrooms: 2, type: 'condo' }
    expect(() => applyFilters(frozen, f)).not.toThrow()
    expect(frozen).toHaveLength(4)
  })

  it('rejects minPrice greater than maxPrice', () => {
    const f: FilterState = { ...ALL, minPrice: 900_000, maxPrice: 100_000 }
    expect(validateFilters(f)).not.toBeNull()
    expect(() => applyFilters(houses(), f)).toThrow(RangeError)
  })

  it('rejects negative price bounds', () => {
    const f: FilterState = { ...ALL, minPrice: -1 }
    expect(validateFilters(f)).not.toBeNull()
    expect(() => applyFilters(houses(), f)).toThrow(RangeError)
  })

  it('rejects fractional minBedrooms', () => {
    const f: FilterState = { ...ALL, minBedrooms: 2.5 }
    expect(validateFilters(f)).not.toBeNull()
    expect(() => applyFilters(houses(), f)).toThrow(RangeError)
  })

  it('rejects NaN price bounds', () => {
    const f: FilterState = { ...ALL, minPrice: Number.NaN }
    expect(validateFilters(f)).not.toBeNull()
    expect(() => applyFilters(houses(), f)).toThrow(RangeError)
  })
})
