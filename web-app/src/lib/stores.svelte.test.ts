import { describe, expect, it } from 'vitest'
import { defaultFilters } from './filters'
import type { FilterState } from './filters'
import { createHousingProgramState } from './stores.svelte'
import type { HousingProgram } from './types'
import { FIXTURE_PROGRAMS, fixtureById } from './test-fixtures/programs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ids(programs: readonly HousingProgram[]): string[] {
  return programs.map((p) => p.id)
}

/** Merge partial overrides onto the neutral filter state. */
function filters(overrides: Partial<FilterState> = {}): FilterState {
  return { ...defaultFilters(), ...overrides }
}

/** A plain mutable deep copy of the fixtures, for mutation checks. */
function mutablePrograms(): HousingProgram[] {
  return structuredClone(FIXTURE_PROGRAMS) as HousingProgram[]
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe('createHousingProgramState — default state', () => {
  it('starts with default filters and filteredPrograms equal to all programs', () => {
    const state = createHousingProgramState(FIXTURE_PROGRAMS)

    expect(state.filters).toEqual(defaultFilters())
    expect(state.filters).not.toBe(defaultFilters())
    expect(ids(state.programs)).toEqual(ids(FIXTURE_PROGRAMS))
    expect(state.filteredPrograms).toEqual(FIXTURE_PROGRAMS)
  })
})

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('createHousingProgramState — filtering', () => {
  it('a filter state matching a subset yields exactly that subset, order preserved', () => {
    const state = createHousingProgramState(FIXTURE_PROGRAMS)

    state.setFilters(filters({ classifications: ['VERIFIED REENTRY HOUSING'] }))
    expect(ids(state.filteredPrograms)).toEqual(['fx-01', 'fx-13'])

    state.setFilters(filters({ wards: [6] }))
    expect(ids(state.filteredPrograms)).toEqual(['fx-01', 'fx-06', 'fx-07', 'fx-12'])

    state.setFilters(filters({ minBedsUnits: 25 }))
    expect(ids(state.filteredPrograms)).toEqual(['fx-01', 'fx-03', 'fx-09', 'fx-10', 'fx-12', 'fx-13'])
  })

  it('setFilters with a valid state updates filters and filteredPrograms', () => {
    const state = createHousingProgramState(FIXTURE_PROGRAMS)
    const next = filters({ housingCategories: ['transitional'], searchText: 'shelter &' })

    state.setFilters(next)

    expect(state.filters).toEqual(next)
    // fx-02 and fx-12 are transitional; only fx-12's name contains 'shelter &'.
    expect(ids(state.filteredPrograms)).toEqual(['fx-12'])
  })
})

// ---------------------------------------------------------------------------
// setFilters validation
// ---------------------------------------------------------------------------

describe('createHousingProgramState — invalid setFilters', () => {
  it('throws RangeError for a duplicate selection, a bad enum, and a fractional minBedsUnits', () => {
    const state = createHousingProgramState(FIXTURE_PROGRAMS)
    const committed = filters({ classifications: ['VERIFIED REENTRY HOUSING'], minBedsUnits: 10 })
    state.setFilters(committed)
    const before = ids(state.filteredPrograms)

    const invalidStates: FilterState[] = [
      filters({ wards: [1, 1] }),
      filters({ gendersServed: ['everyone'] as unknown as FilterState['gendersServed'] }),
      filters({ minBedsUnits: 2.5 }),
    ]
    for (const bad of invalidStates) {
      expect(() => state.setFilters(bad)).toThrow(RangeError)
      expect(() => state.setFilters(bad)).toThrow(/^Invalid filters: /)
    }

    expect(state.filters).toEqual(committed)
    expect(ids(state.filteredPrograms)).toEqual(before)
  })
})

// ---------------------------------------------------------------------------
// resetFilters
// ---------------------------------------------------------------------------

describe('createHousingProgramState — resetFilters', () => {
  it('restores default filters and unrestricted results', () => {
    const state = createHousingProgramState(FIXTURE_PROGRAMS)
    state.setFilters(filters({ classifications: ['VERIFIED REENTRY HOUSING'], minBedsUnits: 30 }))
    expect(state.filteredPrograms.length).toBeLessThan(FIXTURE_PROGRAMS.length)

    state.resetFilters()

    expect(state.filters).toEqual(defaultFilters())
    expect(state.filteredPrograms).toEqual(FIXTURE_PROGRAMS)
  })
})

// ---------------------------------------------------------------------------
// Mutation isolation
// ---------------------------------------------------------------------------

describe('createHousingProgramState — mutation isolation', () => {
  it('mutating caller-owned selection arrays after setFilters does not change committed state', () => {
    const state = createHousingProgramState(FIXTURE_PROGRAMS)
    const next = filters({
      classifications: ['VERIFIED REENTRY HOUSING'],
      wards: [8],
      gendersServed: ['men'],
      minBedsUnits: 30,
    })

    state.setFilters(next)
    const committedSnapshot = state.filters
    const resultsSnapshot = ids(state.filteredPrograms)

    // Caller mutates every selection array and scalar afterwards.
    ;(next.classifications as string[]).push('NEEDS VERIFICATION')
    ;(next.housingCategories as string[]).push('transitional')
    ;(next.wards as number[]).push(1, 2, 3)
    ;(next.gendersServed as string[]).push('women')
    ;(next.householdTypes as string[]).push('families')
    ;(next.rentCostCategories as string[]).push('free')
    const scalars = next as unknown as { searchText: string; minBedsUnits: number | null }
    scalars.searchText = 'polluted'
    scalars.minBedsUnits = 0

    expect(state.filters).toEqual(committedSnapshot)
    expect(state.filters.classifications).not.toBe(next.classifications)
    expect(state.filters.wards).not.toBe(next.wards)
    expect(ids(state.filteredPrograms)).toEqual(resultsSnapshot)
  })

  it('mutating the initialPrograms array after factory creation does not change programs', () => {
    const mutable = mutablePrograms()
    const state = createHousingProgramState(mutable)

    mutable.push(fixtureById('fx-01'))
    mutable.splice(0, 3)
    mutable[0] = fixtureById('fx-14')

    expect(ids(state.programs)).toEqual(ids(FIXTURE_PROGRAMS))
    expect(state.programs).toHaveLength(FIXTURE_PROGRAMS.length)
    expect(state.filteredPrograms).toEqual(FIXTURE_PROGRAMS)
  })
})

// ---------------------------------------------------------------------------
// Instance independence
// ---------------------------------------------------------------------------

describe('createHousingProgramState — instance independence', () => {
  it('two factory instances share no state', () => {
    const a = createHousingProgramState(FIXTURE_PROGRAMS)
    const b = createHousingProgramState(FIXTURE_PROGRAMS)

    a.setFilters(filters({ classifications: ['VERIFIED REENTRY HOUSING'] }))

    expect(ids(a.filteredPrograms)).toEqual(['fx-01', 'fx-13'])
    expect(b.filters).toEqual(defaultFilters())
    expect(b.filteredPrograms).toEqual(FIXTURE_PROGRAMS)

    b.setFilters(filters({ wards: ['other-unknown'] }))
    expect(ids(b.filteredPrograms)).toEqual(['fx-04', 'fx-08'])
    expect(ids(a.filteredPrograms)).toEqual(['fx-01', 'fx-13'])
  })
})

// ---------------------------------------------------------------------------
// Empty initial array
// ---------------------------------------------------------------------------

describe('createHousingProgramState — empty initial array', () => {
  it('yields empty programs and filteredPrograms without errors', () => {
    const state = createHousingProgramState([])

    expect(state.programs).toEqual([])
    expect(state.filteredPrograms).toEqual([])

    state.setFilters(filters({ classifications: ['VERIFIED REENTRY HOUSING'] }))
    expect(state.filteredPrograms).toEqual([])

    state.resetFilters()
    expect(state.filters).toEqual(defaultFilters())
    expect(state.filteredPrograms).toEqual([])
  })
})
