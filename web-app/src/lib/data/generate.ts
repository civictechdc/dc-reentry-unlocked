/**
 * Synthetic D.C. housing generator.
 *
 * Determinism contract: a fresh, seeded Faker instance is created on every
 * call (no shared RNG state), so `generateHouses(seed, count)` always returns
 * the exact same list for the same arguments.
 *
 * Placement: candidates are drawn uniformly from the inclusive D.C.
 * rectangle and kept only when they also fall inside the D.C. boundary
 * polygon, so every generated point satisfies both constraints.
 */

import { Faker, base, en, en_US } from '@faker-js/faker'
import type { House, HouseType } from '../types'
import { DC_BOUNDARY, DC_RECTANGLE, pointInPolygon } from './geometry'

const HOUSE_TYPES: readonly HouseType[] = ['single-family', 'townhouse', 'condo']

const PRICE_MIN = 200_000
const PRICE_MAX = 2_500_000
const BEDROOMS_MIN = 1
const BEDROOMS_MAX = 6
const SQFT_MIN = 500
const SQFT_MAX = 5000

export function generateHouses(seed: number, count: number = 75): House[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`count must be a positive integer, got ${count}`)
  }

  const faker = new Faker({ locale: [en_US, en, base] })
  faker.seed(seed)

  const houses: House[] = []
  while (houses.length < count) {
    const lat = faker.number.float({ min: DC_RECTANGLE.latMin, max: DC_RECTANGLE.latMax })
    const lon = faker.number.float({ min: DC_RECTANGLE.lonMin, max: DC_RECTANGLE.lonMax })
    if (!pointInPolygon(lat, lon, DC_BOUNDARY)) continue

    houses.push({
      id: `h-${String(houses.length + 1).padStart(4, '0')}`,
      address: `${faker.location.streetAddress()}, Washington, DC`,
      lat,
      lon,
      price: faker.number.int({ min: PRICE_MIN, max: PRICE_MAX }),
      bedrooms: faker.number.int({ min: BEDROOMS_MIN, max: BEDROOMS_MAX }),
      bathrooms: faker.number.int({ min: 2, max: 9 }) / 2,
      sqft: faker.number.int({ min: SQFT_MIN, max: SQFT_MAX }),
      type: faker.helpers.arrayElement(HOUSE_TYPES),
    })
  }

  return houses
}
