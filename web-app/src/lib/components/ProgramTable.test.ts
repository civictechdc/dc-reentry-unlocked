import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { FIXTURE_PROGRAMS, fixtureById } from '../test-fixtures/programs'
import ProgramTable from './ProgramTable.svelte'

function bodyRows(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

/** The program row carrying the given stable data-id (fails loudly if absent). */
function rowById(id: string): HTMLElement {
  const row = screen.getByRole('table').querySelector(`tbody tr[data-id="${id}"]`)
  if (!(row instanceof HTMLElement)) {
    throw new Error(`No program row with data-id "${id}"`)
  }
  return row
}

function cellsOf(row: HTMLElement): HTMLElement[] {
  return within(row).getAllByRole('cell')
}

describe('ProgramTable', () => {
  it('renders all ten header columns', () => {
    render(ProgramTable, { props: { programs: [] } })

    for (const header of [
      'Provider / program',
      'Classification',
      'Housing categories',
      'Service area',
      'Gender served',
      'Household type',
      'Population served',
      'Rent / cost',
      'Vacant beds / units',
      'Sample address',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('disclaims the address column with a muted footnote', () => {
    render(ProgramTable, { props: { programs: [] } })

    expect(
      screen.getByText('Addresses are unrelated real-DC samples, not program locations.'),
    ).toBeInTheDocument()
  })

  it('renders every field for a fully populated fixture', () => {
    render(ProgramTable, { props: { programs: [fixtureById('fx-01')] } })

    const cells = cellsOf(rowById('fx-01'))
    expect(cells).toHaveLength(10)
    expect(cells[0]).toHaveTextContent('Flagship Permanent Supportive Housing')
    expect(cells[0]).toHaveTextContent('Capital Reentry Housing Collaborative')
    expect(cells[1]).toHaveTextContent('Verified reentry housing')
    expect(cells[2]).toHaveTextContent('Permanent supportive')
    expect(cells[3]).toHaveTextContent('Citywide')
    expect(cells[4]).toHaveTextContent('All genders')
    expect(cells[5]).toHaveTextContent('Individuals and families')
    expect(cells[6]).toHaveTextContent(
      'Families and single adults returning from incarceration',
    )
    expect(cells[7]).toHaveTextContent(
      'Income-based rent (generally about 30% of adjusted household income)',
    )
    expect(cells[8]).toHaveTextContent('50 (50 units)')
    expect(cells[9]).toHaveTextContent('100 Example St SE, Washington, DC 20003')
  })

  it('falls back to "Not listed" for null population and rent text', () => {
    render(ProgramTable, { props: { programs: [fixtureById('fx-02')] } })

    const cells = cellsOf(rowById('fx-02'))
    expect(cells[6]).toHaveTextContent('Not listed')
    expect(cells[7]).toHaveTextContent('Not listed')
  })

  it('always shows the parsed beds/units count, with source text when listed', () => {
    render(ProgramTable, {
      props: { programs: [fixtureById('fx-02'), fixtureById('fx-05')] },
    })

    // fx-02: bedsUnitsText is null — the bare parsed count is still shown.
    expect(cellsOf(rowById('fx-02'))[8]).toHaveTextContent('0')
    // fx-05: bedsUnitsText is null too — count only, no parentheses.
    expect(cellsOf(rowById('fx-05'))[8]).toHaveTextContent('8')
    expect(cellsOf(rowById('fx-05'))[8].textContent).not.toContain('(')
  })

  it('formats the service area for every ward shape', () => {
    render(ProgramTable, {
      props: {
        programs: [
          fixtureById('fx-02'),
          fixtureById('fx-03'),
          fixtureById('fx-04'),
          fixtureById('fx-05'),
        ],
      },
    })

    expect(cellsOf(rowById('fx-02'))[3]).toHaveTextContent('Ward 1')
    expect(cellsOf(rowById('fx-03'))[3]).toHaveTextContent('Wards 5, 7, 8')
    expect(cellsOf(rowById('fx-04'))[3]).toHaveTextContent('Not listed')
    expect(cellsOf(rowById('fx-05'))[3]).toHaveTextContent('Ward 3')
  })

  it('joins multiple housing categories with commas', () => {
    render(ProgramTable, { props: { programs: [fixtureById('fx-05')] } })

    expect(cellsOf(rowById('fx-05'))[2]).toHaveTextContent(
      'Rapid rehousing, Homelessness prevention',
    )
  })

  it('labels unknown gender and household values readably', () => {
    render(ProgramTable, { props: { programs: [fixtureById('fx-08')] } })

    const cells = cellsOf(rowById('fx-08'))
    expect(cells[4]).toHaveTextContent('Not listed / unknown')
    expect(cells[5]).toHaveTextContent('Not listed / unknown')
  })

  it('renders one keyed row per program in prop order', () => {
    const programs = [fixtureById('fx-03'), fixtureById('fx-01'), fixtureById('fx-02')]
    render(ProgramTable, { props: { programs } })

    const rows = bodyRows()
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.getAttribute('data-id'))).toEqual(['fx-03', 'fx-01', 'fx-02'])
    // Row order follows prop order, not fixture order.
    expect(cellsOf(rows[0]!)[0]).toHaveTextContent('Family Emergency Shelter')
  })

  it('keys every program row with a data-id attribute', () => {
    render(ProgramTable, { props: { programs: FIXTURE_PROGRAMS } })

    const rows = bodyRows()
    expect(rows).toHaveLength(FIXTURE_PROGRAMS.length)
    for (const row of rows) {
      expect(row.getAttribute('data-id')).toMatch(/^fx-/)
    }
  })

  it('shows the empty state message instead of program rows', () => {
    render(ProgramTable, { props: { programs: [] } })

    expect(screen.getByText('No programs match the current filters.')).toBeInTheDocument()
    const rows = bodyRows()
    expect(rows).toHaveLength(1)
    // The message row is not a program row.
    expect(rows[0]!.hasAttribute('data-id')).toBe(false)
  })
})
