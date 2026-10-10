import { describe, expect, it } from 'vitest'
import { generateHouses } from './generate'
import { DC_BOUNDARY, inDCRectangle, pointInPolygon } from './geometry'
import type { House, HouseType } from '../types'

const HOUSE_TYPES: readonly HouseType[] = ['single-family', 'townhouse', 'condo']

function isValidHouse(h: House): boolean {
  return (
    /^h-\d{4,}$/.test(h.id) &&
    typeof h.address === 'string' &&
    h.address.length > 0 &&
    h.address.endsWith('Washington, DC') &&
    Number.isInteger(h.price) &&
    h.price >= 200_000 &&
    h.price <= 2_500_000 &&
    Number.isInteger(h.bedrooms) &&
    h.bedrooms >= 1 &&
    h.bedrooms <= 6 &&
    h.bathrooms >= 1 &&
    h.bathrooms <= 4.5 &&
    h.bathrooms * 2 === Math.round(h.bathrooms * 2) &&
    Number.isInteger(h.sqft) &&
    h.sqft >= 500 &&
    h.sqft <= 5000 &&
    HOUSE_TYPES.includes(h.type)
  )
}

describe('generateHouses', () => {
  it('is deterministic: same seed, same output, even with interleaved calls', () => {
    const a = generateHouses(42)
    generateHouses(7, 3) // interleaved call with another seed
    const b = generateHouses(42)
    expect(a).toEqual(b)
  })

  it('produces different output for different seeds', () => {
    expect(generateHouses(42)).not.toEqual(generateHouses(43))
  })

  it('returns exactly `count` houses (default 75)', () => {
    expect(generateHouses(7, 10)).toHaveLength(10)
    expect(generateHouses(7, 1)).toHaveLength(1)
    expect(generateHouses(1)).toHaveLength(75)
  })

  it('assigns unique ids in h-NNNN order', () => {
    const ids = generateHouses(5, 120).map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('h-0001')
    expect(ids[119]).toBe('h-0120')
  })

  it('produces only valid houses per the type contract', () => {
    for (const h of generateHouses(99, 75)) {
      expect(isValidHouse(h), `invalid house: ${JSON.stringify(h)}`).toBe(true)
    }
  })

  it('places every house inside the rectangle AND the D.C. polygon', () => {
    for (const h of generateHouses(123, 75)) {
      expect(inDCRectangle(h.lat, h.lon), `outside rectangle: ${h.id}`).toBe(true)
      expect(pointInPolygon(h.lat, h.lon, DC_BOUNDARY), `outside polygon: ${h.id}`).toBe(true)
    }
  })

  it('throws RangeError for invalid counts', () => {
    for (const count of [0, -1, 1.5, Number.NaN]) {
      expect(() => generateHouses(1, count)).toThrow(RangeError)
    }
  })
})
