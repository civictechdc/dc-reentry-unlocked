import { describe, expect, it } from 'vitest'
import { generateHouses } from './data/generate'
import { defaultFilters } from './filters'
import type { FilterState } from './filters'
import { createHouseState } from './stores.svelte'

const houses = generateHouses(42)

const condoFilter: FilterState = {
  minPrice: 500_000,
  maxPrice: 1_000_000,
  minBedrooms: 2,
  type: 'condo',
}

describe('createHouseState', () => {
  it('starts with filteredHouses equal to all houses and default filters', () => {
    const state = createHouseState(houses)

    expect(state.houses).toEqual(houses)
    expect(state.filters).toEqual(defaultFilters())
    expect(state.filteredHouses).toEqual(houses)
  })

  it('setFilters updates filters and the derived filteredHouses', () => {
    const state = createHouseState(houses)

    state.setFilters(condoFilter)

    expect(state.filters).toEqual(condoFilter)
    const expected = houses.filter(
      (h) =>
        h.price >= 500_000 &&
        h.price <= 1_000_000 &&
        h.bedrooms >= 2 &&
        h.type === 'condo',
    )
    expect(state.filteredHouses).toEqual(expected)
  })

  it('resetFilters restores default filters and the full house list', () => {
    const state = createHouseState(houses)
    state.setFilters(condoFilter)
    expect(state.filteredHouses.length).toBeLessThan(houses.length)

    state.resetFilters()

    expect(state.filters).toEqual(defaultFilters())
    expect(state.filteredHouses).toEqual(houses)
  })

  it('invalid setFilters throws RangeError and leaves state unchanged', () => {
    const state = createHouseState(houses)
    state.setFilters(condoFilter)
    const before = state.filteredHouses

    expect(() =>
      state.setFilters({ ...condoFilter, minPrice: 2_000_000, maxPrice: 100 }),
    ).toThrow(RangeError)

    expect(state.filters).toEqual(condoFilter)
    expect(state.filteredHouses).toEqual(before)
  })

  it('two instances are independent', () => {
    const a = createHouseState(houses)
    const b = createHouseState(houses)

    a.setFilters(condoFilter)

    expect(a.filters).toEqual(condoFilter)
    expect(b.filters).toEqual(defaultFilters())
    expect(b.filteredHouses).toEqual(houses)
  })
})
