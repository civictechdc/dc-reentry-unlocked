import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateHouses } from './lib/data/generate'
import App from './App.svelte'

/**
 * Leaflet mock — same shape as the MapView unit-test mock. Records maps,
 * tile layers and markers so the parity test can compare the marker set
 * against the table rows without any network access.
 */
const leaflet = vi.hoisted(() => {
  type MockMarker = {
    latlng: [number, number]
    onMap: unknown
    removed: boolean
    addTo: (map: unknown) => MockMarker
    bindPopup: (content: unknown) => MockMarker
    remove: () => void
  }

  const state = {
    maps: [] as { removed: boolean }[],
    tileLayers: [] as { url: string; options: Record<string, unknown> }[],
    markers: [] as MockMarker[],
  }

  function createMarker(latlng: [number, number]): MockMarker {
    const marker: MockMarker = {
      latlng,
      onMap: null,
      removed: false,
      addTo(map: unknown) {
        marker.onMap = map
        return marker
      },
      bindPopup() {
        return marker
      },
      remove() {
        marker.removed = true
      },
    }
    state.markers.push(marker)
    return marker
  }

  const L = {
    map() {
      const map = {
        removed: false,
        fitBounds() {},
        setView() {},
        remove() {
          map.removed = true
        },
      }
      state.maps.push(map)
      return map
    },
    tileLayer(url: string, options?: Record<string, unknown>) {
      const layer = { url, options: options ?? {}, on: () => layer, addTo: () => layer }
      state.tileLayers.push(layer)
      return layer
    },
    marker: createMarker,
    latLngBounds(coords: unknown) {
      return { coords }
    },
    icon(options: Record<string, unknown>) {
      return options
    },
    Icon: { Default: { mergeOptions() {} } },
  }

  return { L, state }
})

vi.mock('leaflet', () => ({ default: leaflet.L }))

const allHouses = generateHouses(42)

/** Live markers on the current map, keyed by "lat,lon". */
function liveMarkerKeys(): Set<string> {
  const map = leaflet.state.maps.at(-1)
  return new Set(
    leaflet.state.markers
      .filter((m) => m.onMap === map && !m.removed)
      .map((m) => m.latlng.join(',')),
  )
}

/** House rows in the table body (excludes the empty-state row), keyed by address. */
function tableRowAddresses(): string[] {
  const table = screen.getByRole('table')
  const rows = within(table).getAllByRole('row').slice(1)
  return rows
    .filter((row) => !row.classList.contains('empty-row'))
    .map((row) => within(row).queryAllByRole('cell')[0]?.textContent ?? '')
    .filter((address) => address !== '')
}

function badgeCount(): number {
  const badge = screen.getByText(/\d+ houses?/)
  return Number(badge.textContent!.match(/\d+/)![0])
}

/**
 * THE parity assertion: marker id set === table row id set === badge count.
 * Ids are recovered through the generated data (lat/lon and address are
 * unique per generated house).
 */
function expectParity(expected: typeof allHouses): void {
  const expectedIds = new Set(expected.map((h) => h.id))
  const latlngToId = new Map(allHouses.map((h) => [`${h.lat},${h.lon}`, h.id]))
  const addressToId = new Map(allHouses.map((h) => [h.address, h.id]))

  const markerIds = new Set(
    [...liveMarkerKeys()].map((key) => latlngToId.get(key)),
  )
  const rowIds = new Set(tableRowAddresses().map((a) => addressToId.get(a)))

  expect(markerIds).toEqual(expectedIds)
  expect(rowIds).toEqual(expectedIds)
  expect(badgeCount()).toBe(expected.length)
}

function expectedFor(f: {
  minPrice?: number | null
  maxPrice?: number | null
  minBedrooms?: number
  type?: string
}): typeof allHouses {
  return allHouses.filter(
    (h) =>
      (f.minPrice == null || h.price >= f.minPrice) &&
      (f.maxPrice == null || h.price <= f.maxPrice) &&
      (f.minBedrooms == null || h.bedrooms >= f.minBedrooms) &&
      (f.type == null || f.type === 'all' || h.type === f.type),
  )
}

/**
 * The filter panel commits on `change` (blur/Enter), not per keystroke, so
 * integration tests type into an input and then fire the change event a real
 * blur/Enter would produce.
 */
async function typeAndCommit(input: HTMLElement, text: string): Promise<void> {
  await userEvent.type(input, text)
  await fireEvent.change(input)
}

afterEach(() => {
  leaflet.state.maps.length = 0
  leaflet.state.tileLayers.length = 0
  leaflet.state.markers.length = 0
})

describe('App integration', () => {
  it('starts in parity: badge, table rows and markers all show every house', async () => {
    await render(App)

    expectParity(allHouses)
  })

  it('stays in parity after a price filter', async () => {
    await render(App)

    await typeAndCommit(screen.getByLabelText('Min price'), '1000000')

    expectParity(expectedFor({ minPrice: 1_000_000 }))
  })

  it('stays in parity after a max-price filter', async () => {
    await render(App)

    await typeAndCommit(screen.getByLabelText('Max price'), '500000')

    expectParity(expectedFor({ maxPrice: 500_000 }))
  })

  it('stays in parity after a bedrooms filter', async () => {
    await render(App)

    await typeAndCommit(screen.getByLabelText('Min bedrooms'), '3')

    expectParity(expectedFor({ minBedrooms: 3 }))
  })

  it('stays in parity after a type filter', async () => {
    await render(App)

    await userEvent.selectOptions(screen.getByLabelText('Property type'), 'condo')

    expectParity(expectedFor({ type: 'condo' }))
  })

  it('stays in parity with combined filters', async () => {
    await render(App)

    await typeAndCommit(screen.getByLabelText('Min price'), '400000')
    await typeAndCommit(screen.getByLabelText('Min bedrooms'), '2')
    await userEvent.selectOptions(screen.getByLabelText('Property type'), 'townhouse')

    expectParity(expectedFor({ minPrice: 400_000, minBedrooms: 2, type: 'townhouse' }))
  })

  it('restores full parity after reset', async () => {
    await render(App)

    await typeAndCommit(screen.getByLabelText('Min price'), '1000000')
    expectParity(expectedFor({ minPrice: 1_000_000 }))

    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))

    expectParity(allHouses)
  })

  it('shows a zero-result state: badge 0, empty table row, no markers', async () => {
    await render(App)

    // Generated prices top out at 2,500,000, so this minimum guarantees an
    // empty result set.
    await typeAndCommit(screen.getByLabelText('Min price'), '2500001')

    expectParity(expectedFor({ minPrice: 2_500_001 }))
    expect(badgeCount()).toBe(0)
    expect(screen.getByText('0 houses')).toBeInTheDocument()
    expect(screen.getByText('No houses match the current filters.')).toBeInTheDocument()
  })

  it('shows the synthetic-data notice and renders the map and table', async () => {
    await render(App)

    expect(screen.getByText(/synthetic sample data/i)).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(leaflet.state.maps).toHaveLength(1)
    expect(leaflet.state.tileLayers[0]!.url).toContain('openstreetmap.org')
  })
})
