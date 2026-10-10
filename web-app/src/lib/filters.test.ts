import { describe, expect, it } from 'vitest'
import {
  CLASSIFICATIONS,
  GENDERS_SERVED,
  HOUSEHOLD_TYPES,
  HOUSING_CATEGORIES,
  RENT_COST_CATEGORIES,
  WARD_SELECTIONS,
} from './types'
import type {
  Classification,
  GenderServed,
  HouseholdType,
  HousingCategory,
  HousingProgram,
  RentCostCategory,
  WardSelection,
} from './types'
import { applyFilters, defaultFilters, validateFilters } from './filters'
import type { FilterState } from './filters'
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
// Contracts and coverage
// ---------------------------------------------------------------------------

describe('option lists', () => {
  it('exposes the exact contract value lists', () => {
    expect([...CLASSIFICATIONS]).toEqual([
      'GENERAL HOUSING — REENTRY ACCESS POSSIBLE',
      'VERIFIED REENTRY HOUSING',
      'VERIFIED CRIMINAL-RECORD-FRIENDLY',
      'NEEDS VERIFICATION',
    ])
    expect([...HOUSING_CATEGORIES]).toEqual([
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
    ])
    expect([...WARD_SELECTIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 'other-unknown'])
    expect([...GENDERS_SERVED]).toEqual(['men', 'women', 'all-genders', 'other-unknown'])
    expect([...HOUSEHOLD_TYPES]).toEqual(['individuals', 'families', 'both', 'other-unknown'])
    expect([...RENT_COST_CATEGORIES]).toEqual([
      'income-based',
      'subsidized-reduced',
      'free',
      'market-rate',
    ])
  })
})

describe('fixture coverage', () => {
  it('covers every classification', () => {
    for (const c of CLASSIFICATIONS as readonly Classification[]) {
      expect(
        FIXTURE_PROGRAMS.some((p) => p.classification === c),
        `no fixture with classification ${c}`,
      ).toBe(true)
    }
  })

  it('covers every housing category', () => {
    for (const c of HOUSING_CATEGORIES as readonly HousingCategory[]) {
      expect(
        FIXTURE_PROGRAMS.some((p) => p.housingCategories.includes(c)),
        `no fixture with housing category ${c}`,
      ).toBe(true)
    }
  })

  it('covers every ward shape and every ward number', () => {
    const shapes = FIXTURE_PROGRAMS.map((p) => p.wardsServed)
    expect(shapes.some((w) => w[0] === 'citywide')).toBe(true)
    expect(shapes.some((w) => w[0] === 'other-unknown')).toBe(true)
    const numeric = shapes.filter((w) => typeof w[0] === 'number')
    expect(numeric.some((w) => w.length > 1)).toBe(true) // multi-ward
    expect(numeric.some((w) => w.length === 1)).toBe(true) // single ward
    const seen = new Set(numeric.flat())
    for (const ward of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      expect(seen.has(ward), `no fixture serving ward ${ward}`).toBe(true)
    }
  })

  it('covers every gender, household type and rent category', () => {
    for (const g of GENDERS_SERVED as readonly GenderServed[]) {
      expect(FIXTURE_PROGRAMS.some((p) => p.genderServed === g), `gender ${g}`).toBe(true)
    }
    for (const h of HOUSEHOLD_TYPES as readonly HouseholdType[]) {
      expect(FIXTURE_PROGRAMS.some((p) => p.householdType === h), `household ${h}`).toBe(true)
    }
    for (const r of RENT_COST_CATEGORIES as readonly RentCostCategory[]) {
      expect(FIXTURE_PROGRAMS.some((p) => p.rentCostCategory === r), `rent ${r}`).toBe(true)
    }
  })

  it('covers bedsUnits 0, boundary values, and null/non-null optional text', () => {
    expect(FIXTURE_PROGRAMS.some((p) => p.bedsUnits === 0)).toBe(true)
    expect(FIXTURE_PROGRAMS.some((p) => p.bedsUnits > 0)).toBe(true)
    for (const field of ['populationServed', 'rentCostText', 'bedsUnitsText', 'phone', 'email', 'website', 'programUrl'] as const) {
      expect(
        FIXTURE_PROGRAMS.some((p) => p[field] === null),
        `no fixture with null ${field}`,
      ).toBe(true)
      expect(
        FIXTURE_PROGRAMS.some((p) => p[field] !== null),
        `no fixture with non-null ${field}`,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// defaultFilters
// ---------------------------------------------------------------------------

describe('defaultFilters', () => {
  it('is neutral: every fixture passes', () => {
    expect(defaultFilters()).toEqual({
      classifications: [],
      housingCategories: [],
      wards: [],
      gendersServed: [],
      householdTypes: [],
      rentCostCategories: [],
      searchText: '',
      minBedsUnits: null,
    })
    expect(ids(applyFilters(FIXTURE_PROGRAMS, defaultFilters()))).toHaveLength(
      FIXTURE_PROGRAMS.length,
    )
  })

  it('returns fresh arrays on every call', () => {
    const a = defaultFilters()
    const b = defaultFilters()
    expect(a.classifications).not.toBe(b.classifications)
    expect(a.housingCategories).not.toBe(b.housingCategories)
    expect(a.wards).not.toBe(b.wards)
    // Mutating one instance (through a mutable view) must not affect another.
    const mutableView = a as unknown as { classifications: Classification[]; searchText: string }
    mutableView.classifications.push('VERIFIED REENTRY HOUSING')
    mutableView.searchText = 'polluted'
    expect(b.classifications).toEqual([])
    expect(b.searchText).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Per-dimension matching
// ---------------------------------------------------------------------------

describe('classification filter', () => {
  it('empty selection passes everything', () => {
    expect(applyFilters(FIXTURE_PROGRAMS, filters({ classifications: [] }))).toHaveLength(
      FIXTURE_PROGRAMS.length,
    )
  })

  it('matches the exact classification', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ classifications: ['VERIFIED REENTRY HOUSING'] })))).toEqual([
      'fx-01',
      'fx-13',
    ])
  })

  it('OR-combines within the dimension', () => {
    expect(
      ids(
        applyFilters(
          FIXTURE_PROGRAMS,
          filters({ classifications: ['VERIFIED REENTRY HOUSING', 'NEEDS VERIFICATION'] }),
        ),
      ),
    ).toEqual(['fx-01', 'fx-05', 'fx-13'])
  })
})

describe('housingCategories filter', () => {
  it('matches a record listing the selected category', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ housingCategories: ['transitional'] })))).toEqual([
      'fx-02',
      'fx-12',
    ])
  })

  it('OR-combines categories', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ housingCategories: ['sro', 'market-rate'] })))).toEqual([
      'fx-10',
      'fx-11',
    ])
  })

  it('multi-category records match any one selected category, exactly once', () => {
    const multi = fixtureById('fx-05')
    for (const category of multi.housingCategories) {
      expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ housingCategories: [category] })))).toContain('fx-05')
    }
    const result = applyFilters(
      FIXTURE_PROGRAMS,
      filters({ housingCategories: [...multi.housingCategories] }),
    )
    expect(ids(result).filter((id) => id === 'fx-05')).toHaveLength(1)
  })

  it('AND-combines with classification across dimensions', () => {
    expect(
      ids(
        applyFilters(
          FIXTURE_PROGRAMS,
          filters({
            classifications: ['GENERAL HOUSING — REENTRY ACCESS POSSIBLE'],
            housingCategories: ['emergency-shelter'],
          }),
        ),
      ),
    ).toEqual(['fx-03', 'fx-12'])
  })
})

describe('wards filter', () => {
  it('matches a single-ward record by its ward (citywide records also match)', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [6] })))).toEqual([
      'fx-01',
      'fx-06',
      'fx-07',
      'fx-12',
    ])
  })

  it('multi-ward records match any of their wards', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [7] })))).toEqual([
      'fx-01',
      'fx-03',
      'fx-07',
      'fx-12',
      'fx-14',
    ])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [5] })))).toEqual([
      'fx-01',
      'fx-03',
      'fx-07',
      'fx-12',
    ])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [8] })))).toEqual([
      'fx-01',
      'fx-03',
      'fx-07',
      'fx-09',
      'fx-12',
      'fx-13',
    ])
  })

  it('citywide records match any selection containing a numeric ward', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [1] })))).toEqual([
      'fx-01',
      'fx-02',
      'fx-07',
      'fx-12',
      'fx-13',
    ])
  })

  it("citywide records do not match an 'other-unknown'-only selection", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: ['other-unknown'] })))).toEqual([
      'fx-04',
      'fx-08',
    ])
  })

  it('selecting known wards never matches unknown-ward records', () => {
    const result = ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [1, 2, 3, 4, 5, 6, 7, 8] })))
    expect(result).not.toContain('fx-04')
    expect(result).not.toContain('fx-08')
  })

  it("unknown-ward records match only the 'other-unknown' selection", () => {
    expect(fixtureById('fx-04').wardsServed).toEqual(['other-unknown'])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: ['other-unknown'] })))).toEqual([
      'fx-04',
      'fx-08',
    ])
  })

  it('OR-combines ward selections', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ wards: [1, 6] })))).toEqual([
      'fx-01',
      'fx-02',
      'fx-06',
      'fx-07',
      'fx-12',
      'fx-13',
    ])
  })
})

describe('gendersServed filter', () => {
  it("all-genders records match 'men' selections", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ gendersServed: ['men'] })))).toEqual([
      'fx-01',
      'fx-02',
      'fx-04',
      'fx-06',
      'fx-09',
      'fx-10',
      'fx-12',
      'fx-13',
    ])
  })

  it("all-genders records match 'women' selections", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ gendersServed: ['women'] })))).toEqual([
      'fx-01',
      'fx-03',
      'fx-04',
      'fx-07',
      'fx-09',
      'fx-11',
      'fx-12',
    ])
  })

  it("selecting only 'all-genders' matches only all-genders records (asymmetry)", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ gendersServed: ['all-genders'] })))).toEqual([
      'fx-01',
      'fx-04',
      'fx-09',
      'fx-12',
    ])
    // A men-only record must NOT match an all-genders-only selection.
    expect(fixtureById('fx-02').genderServed).toBe('men')
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ gendersServed: ['all-genders'] })))).not.toContain('fx-02')
  })

  it("unknown-gender records match only the 'other-unknown' selection", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ gendersServed: ['other-unknown'] })))).toEqual([
      'fx-05',
      'fx-08',
      'fx-14',
    ])
  })

  it('OR-combines gender selections', () => {
    expect(
      ids(applyFilters(FIXTURE_PROGRAMS, filters({ gendersServed: ['men', 'other-unknown'] }))),
    ).toEqual(['fx-01', 'fx-02', 'fx-04', 'fx-05', 'fx-06', 'fx-08', 'fx-09', 'fx-10', 'fx-12', 'fx-13', 'fx-14'])
  })
})

describe('householdTypes filter', () => {
  it("'both' records match 'individuals' selections", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ householdTypes: ['individuals'] })))).toEqual([
      'fx-01',
      'fx-02',
      'fx-04',
      'fx-06',
      'fx-09',
      'fx-10',
      'fx-11',
      'fx-12',
      'fx-13',
      'fx-14',
    ])
  })

  it("'both' records match 'families' selections", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ householdTypes: ['families'] })))).toEqual([
      'fx-01',
      'fx-03',
      'fx-04',
      'fx-07',
      'fx-09',
      'fx-13',
    ])
  })

  it("selecting only 'both' matches only both records (asymmetry)", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ householdTypes: ['both'] })))).toEqual([
      'fx-01',
      'fx-04',
      'fx-09',
      'fx-13',
    ])
    // An individuals-only record must NOT match a both-only selection.
    expect(fixtureById('fx-02').householdType).toBe('individuals')
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ householdTypes: ['both'] })))).not.toContain('fx-02')
  })

  it("unknown-household records match only the 'other-unknown' selection", () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ householdTypes: ['other-unknown'] })))).toEqual([
      'fx-05',
      'fx-08',
    ])
  })
})

describe('searchText filter', () => {
  it('matches the provider, case-insensitively', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'capital reentry' })))).toEqual(['fx-01'])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'VILLAGE' })))).toEqual(['fx-03'])
  })

  it('matches the program name, case-insensitively', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'FLAGSHIP' })))).toEqual(['fx-01'])
  })

  it('matches the population served', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'eviction' })))).toEqual(['fx-07'])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'single adults with income' })))).toEqual([
      'fx-10',
    ])
  })

  it('null population contributes nothing', () => {
    for (const id of ['fx-02', 'fx-05', 'fx-08', 'fx-14']) {
      expect(fixtureById(id).populationServed).toBeNull()
    }
    // A population-only query never surfaces a null-population record.
    const result = ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'experiencing homelessness' })))
    expect(result).toEqual(['fx-03', 'fx-12'])
    expect(result.some((id) => fixtureById(id).populationServed === null)).toBe(false)
  })

  it('empty and whitespace-only queries are unrestricted', () => {
    expect(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: '' }))).toHaveLength(FIXTURE_PROGRAMS.length)
    expect(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: '   \t\n ' }))).toHaveLength(
      FIXTURE_PROGRAMS.length,
    )
  })

  it('trims surrounding whitespace', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: '  flagship  ' })))).toEqual(['fx-01'])
  })

  it('treats punctuation literally (no regex)', () => {
    // '(' and '.' are regex metacharacters but must match literally.
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: '(some)' })))).toEqual(['fx-02', 'fx-12'])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'home.' })))).toEqual(['fx-02'])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: '— transitional' })))).toEqual(['fx-02'])
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ searchText: 'a^b|c+d' })))).toEqual([])
  })
})

describe('rentCostCategories filter', () => {
  it('matches the exact category', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ rentCostCategories: ['free'] })))).toEqual([
      'fx-02',
      'fx-07',
      'fx-12',
    ])
  })

  it('OR-combines rent categories', () => {
    expect(
      ids(applyFilters(FIXTURE_PROGRAMS, filters({ rentCostCategories: ['income-based', 'market-rate'] }))),
    ).toEqual(['fx-01', 'fx-04', 'fx-05', 'fx-06', 'fx-10', 'fx-13', 'fx-14'])
  })
})

describe('minBedsUnits filter', () => {
  it('null is unrestricted', () => {
    expect(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: null }))).toHaveLength(
      FIXTURE_PROGRAMS.length,
    )
  })

  it('zero is a valid active threshold; with >= semantics it keeps bedsUnits-0 records', () => {
    // 0 must not be coerced to null and must not be rejected: every record has
    // bedsUnits >= 0, so the result equals the unrestricted result.
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: 0 })))).toEqual(
      ids(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: null }))),
    )
    expect(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: 0 }))).toHaveLength(FIXTURE_PROGRAMS.length)
  })

  it('exact boundary is inclusive', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: 25 })))).toEqual([
      'fx-01',
      'fx-03',
      'fx-09',
      'fx-10',
      'fx-12',
      'fx-13',
    ])
  })

  it('below the boundary includes the record, above excludes it', () => {
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: 24 })))).toContain('fx-03')
    expect(ids(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: 26 })))).toEqual([
      'fx-01',
      'fx-09',
      'fx-10',
      'fx-12',
      'fx-13',
    ])
    expect(applyFilters(FIXTURE_PROGRAMS, filters({ minBedsUnits: 121 }))).toEqual([])
  })
})

describe('combined dimensions (AND across, OR within)', () => {
  it('narrows across four dimensions', () => {
    expect(
      ids(
        applyFilters(
          FIXTURE_PROGRAMS,
          filters({
            classifications: ['VERIFIED REENTRY HOUSING'],
            wards: [8],
            gendersServed: ['men'],
            minBedsUnits: 30,
          }),
        ),
      ),
    ).toEqual(['fx-01', 'fx-13'])
  })

  it('combines category and household dimensions', () => {
    expect(
      ids(
        applyFilters(
          FIXTURE_PROGRAMS,
          filters({ housingCategories: ['emergency-shelter'], householdTypes: ['families'] }),
        ),
      ),
    ).toEqual(['fx-03'])
  })

  it('combines unknown-bucket selections across dimensions', () => {
    expect(
      ids(
        applyFilters(
          FIXTURE_PROGRAMS,
          filters({
            classifications: ['VERIFIED CRIMINAL-RECORD-FRIENDLY'],
            wards: ['other-unknown'],
            gendersServed: ['all-genders'],
          }),
        ),
      ),
    ).toEqual(['fx-04'])
  })

  it('can produce zero results', () => {
    expect(
      applyFilters(FIXTURE_PROGRAMS, filters({ classifications: ['NEEDS VERIFICATION'], minBedsUnits: 100 })),
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Purity and ordering
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('does not mutate frozen program inputs', () => {
    const frozen = FIXTURE_PROGRAMS.map((p) => Object.freeze({ ...p }))
    Object.freeze(frozen)
    const f = Object.freeze({
      ...filters({
        classifications: ['GENERAL HOUSING — REENTRY ACCESS POSSIBLE'],
        housingCategories: ['emergency-shelter'],
        wards: [5, 7, 8],
        searchText: 'family',
        minBedsUnits: 20,
      }),
    })
    expect(() => applyFilters(frozen, f)).not.toThrow()
    expect(ids(applyFilters(frozen, f))).toEqual(['fx-03'])
    expect(frozen).toHaveLength(FIXTURE_PROGRAMS.length)
  })

  it('does not mutate a mutable deep copy of the fixtures', () => {
    const programs = mutablePrograms()
    const snapshot = JSON.stringify(programs)
    const f = filters({ wards: ['other-unknown'], gendersServed: ['other-unknown'] })
    // fx-04 is all-genders, so only fx-08 matches both unknown buckets.
    expect(ids(applyFilters(programs, f))).toEqual(['fx-08'])
    expect(JSON.stringify(programs)).toBe(snapshot)
  })

  it('preserves input order', () => {
    const forward = ids(
      applyFilters(FIXTURE_PROGRAMS, filters({ classifications: ['GENERAL HOUSING — REENTRY ACCESS POSSIBLE'] })),
    )
    const reversedInput = [...FIXTURE_PROGRAMS].reverse()
    const fromReversed = ids(
      applyFilters(reversedInput, filters({ classifications: ['GENERAL HOUSING — REENTRY ACCESS POSSIBLE'] })),
    )
    expect(fromReversed).toEqual([...forward].reverse())
  })

  it('emits each matching record exactly once', () => {
    const result = ids(
      applyFilters(
        FIXTURE_PROGRAMS,
        filters({
          housingCategories: [
            'rapid-rehousing',
            'homelessness-prevention',
            'emergency-shelter',
            'transitional',
            'permanent-supportive',
            'affordable-rental',
          ],
        }),
      ),
    )
    expect(new Set(result).size).toBe(result.length)
    // Multi-category records appear once despite matching several selections.
    for (const multi of ['fx-05', 'fx-12', 'fx-13']) {
      expect(result.filter((id) => id === multi)).toHaveLength(1)
    }
  })
})

// ---------------------------------------------------------------------------
// validateFilters
// ---------------------------------------------------------------------------

describe('validateFilters', () => {
  const valid: Record<string, unknown> = {
    classifications: [],
    housingCategories: ['transitional'],
    wards: [1, 'other-unknown'],
    gendersServed: ['men', 'women'],
    householdTypes: [],
    rentCostCategories: ['free'],
    searchText: 'some',
    minBedsUnits: 3,
  }

  it('accepts a valid state', () => {
    expect(validateFilters(valid)).toBeNull()
    expect(validateFilters(defaultFilters())).toBeNull()
  })

  it('accepts unknown extra properties', () => {
    expect(validateFilters({ ...valid, extra: 'ignored' })).toBeNull()
  })

  it('rejects non-object inputs without throwing', () => {
    for (const bad of [null, undefined, 42, 'filters', true, [], () => {}]) {
      expect(() => validateFilters(bad)).not.toThrow()
      expect(validateFilters(bad)).toEqual('filters must be an object')
    }
  })

  it('rejects missing fields, naming the field', () => {
    for (const field of Object.keys(valid)) {
      const partial: Record<string, unknown> = { ...valid }
      delete partial[field]
      const error = validateFilters(partial)
      expect(error, `expected error for missing ${field}`).not.toBeNull()
      expect(error).toContain(field)
    }
  })

  it('rejects non-array selections', () => {
    expect(validateFilters({ ...valid, classifications: 'VERIFIED REENTRY HOUSING' })).toContain(
      'classifications must be an array',
    )
    expect(validateFilters({ ...valid, wards: null })).toContain('wards must be an array')
    expect(validateFilters({ ...valid, gendersServed: {} })).toContain('gendersServed must be an array')
  })

  it('rejects invalid enum entries', () => {
    expect(validateFilters({ ...valid, classifications: ['BOGUS'] })).toContain('classifications')
    expect(validateFilters({ ...valid, housingCategories: ['bogus'] })).toContain('housingCategories')
    expect(validateFilters({ ...valid, gendersServed: ['everyone'] })).toContain('gendersServed')
    expect(validateFilters({ ...valid, householdTypes: ['solo'] })).toContain('householdTypes')
    expect(validateFilters({ ...valid, rentCostCategories: ['cheap'] })).toContain('rentCostCategories')
  })

  it('rejects invalid ward selections', () => {
    for (const bad of [0, 9, -1, 2.5, '3', 'citywide', true, null]) {
      const error = validateFilters({ ...valid, wards: [bad] })
      expect(error, `expected error for ward ${String(bad)}`).not.toBeNull()
      expect(error).toContain('wards')
    }
  })

  it('rejects duplicate entries within a selection', () => {
    expect(
      validateFilters({
        ...valid,
        classifications: ['VERIFIED REENTRY HOUSING', 'VERIFIED REENTRY HOUSING'],
      }),
    ).toContain('duplicate')
    expect(validateFilters({ ...valid, housingCategories: ['sro', 'sro'] })).toContain('duplicate')
    expect(validateFilters({ ...valid, wards: [1, 1] })).toContain('duplicate')
    expect(validateFilters({ ...valid, wards: [1, 'other-unknown', 'other-unknown'] })).toContain('duplicate')
    expect(validateFilters({ ...valid, gendersServed: ['men', 'men'] })).toContain('duplicate')
    expect(validateFilters({ ...valid, householdTypes: ['both', 'both'] })).toContain('duplicate')
    expect(validateFilters({ ...valid, rentCostCategories: ['free', 'free'] })).toContain('duplicate')
  })

  it('rejects non-string searchText', () => {
    for (const bad of [42, null, true, ['x'], {}]) {
      const error = validateFilters({ ...valid, searchText: bad })
      expect(error, `expected error for searchText ${String(bad)}`).not.toBeNull()
      expect(error).toContain('searchText')
    }
  })

  it('rejects invalid minBedsUnits values', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 2.5, '5', true, {}]) {
      const error = validateFilters({ ...valid, minBedsUnits: bad })
      expect(error, `expected error for minBedsUnits ${String(bad)}`).not.toBeNull()
      expect(error).toContain('minBedsUnits')
    }
  })

  it('accepts null and zero minBedsUnits', () => {
    expect(validateFilters({ ...valid, minBedsUnits: null })).toBeNull()
    expect(validateFilters({ ...valid, minBedsUnits: 0 })).toBeNull()
  })

  it('rejects required fields that exist only on the prototype', () => {
    // Every required field is present — but only as an inherited property.
    // Presence must be an own-property check, so this is invalid.
    const protoFilters = Object.create(defaultFilters()) as Record<string, unknown>
    expect(() => validateFilters(protoFilters)).not.toThrow()
    expect(validateFilters(protoFilters)).toBe('classifications is missing')
  })

  it('returns an inspection error instead of throwing on a hostile getter', () => {
    // Structurally complete, but reading `classifications` throws.
    const hostile: Record<string, unknown> = {
      ...defaultFilters(),
      get classifications() {
        throw new Error('boom')
      },
    }
    expect(() => validateFilters(hostile)).not.toThrow()
    expect(validateFilters(hostile)).toBe('filters could not be inspected')
  })

  it('returns an inspection error instead of throwing on a throwing Proxy', () => {
    // Proxy over a structurally valid target whose get trap always throws:
    // the own-property presence check passes, then property access throws.
    const target = defaultFilters() as unknown as Record<string, unknown>
    const throwing = new Proxy(target, {
      get() {
        throw new Error('proxy boom')
      },
    })
    expect(() => validateFilters(throwing)).not.toThrow()
    expect(validateFilters(throwing)).toBe('filters could not be inspected')
  })
})

// ---------------------------------------------------------------------------
// applyFilters error contract
// ---------------------------------------------------------------------------

describe('applyFilters validation', () => {
  it('throws RangeError on invalid filters even with an empty program array', () => {
    expect(() => applyFilters([], filters({ minBedsUnits: Number.NaN }))).toThrow(RangeError)
    expect(() => applyFilters([], filters({ minBedsUnits: Number.NaN }))).toThrow(/^Invalid filters: /)
    expect(() => applyFilters([], { ...defaultFilters(), wards: [99] as unknown as WardSelection[] })).toThrow(
      RangeError,
    )
  })

  it('throws RangeError on a malformed runtime object', () => {
    const malformed = { classifications: 'all', searchText: 7 }
    expect(() => applyFilters(FIXTURE_PROGRAMS, malformed as unknown as FilterState)).toThrow(RangeError)
  })
})
