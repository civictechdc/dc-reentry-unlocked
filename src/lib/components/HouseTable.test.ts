import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import type { House } from '../types'
import HouseTable from './HouseTable.svelte'

const houses: House[] = [
  {
    id: 'h-0001',
    address: '100 Oak St, Washington, DC',
    lat: 38.9,
    lon: -76.98,
    price: 450_000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1200,
    type: 'townhouse',
  },
  {
    id: 'h-0002',
    address: '200 Elm Ave, Washington, DC',
    lat: 38.91,
    lon: -76.97,
    price: 1_250_000,
    bedrooms: 5,
    bathrooms: 3.5,
    sqft: 3200,
    type: 'single-family',
  },
]

function bodyRows(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('HouseTable', () => {
  it('renders header columns', () => {
    render(HouseTable, { props: { houses } })

    for (const header of ['Address', 'Price', 'Beds', 'Baths', 'Sqft', 'Type']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('renders one row per house with correct cells', () => {
    render(HouseTable, { props: { houses } })

    const rows = bodyRows()
    expect(rows).toHaveLength(2)

    const first = within(rows[0]!).getAllByRole('cell')
    expect(first[0]).toHaveTextContent('100 Oak St, Washington, DC')
    expect(first[1]).toHaveTextContent('$450,000')
    expect(first[2]).toHaveTextContent('3')
    expect(first[3]).toHaveTextContent('2')
    expect(first[4]).toHaveTextContent('1200')
    expect(first[5]).toHaveTextContent('townhouse')

    const second = within(rows[1]!).getAllByRole('cell')
    expect(second[1]).toHaveTextContent('$1,250,000')
    expect(second[3]).toHaveTextContent('3.5')
  })

  it('shows the empty state message when no houses match', () => {
    render(HouseTable, { props: { houses: [] } })

    expect(screen.getByText('No houses match the current filters.')).toBeInTheDocument()
    // Only the message row — no house rows.
    expect(bodyRows()).toHaveLength(1)
  })
})
