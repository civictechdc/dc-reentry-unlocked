import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HousingProgram } from './lib/types'
import { FIXTURE_PROGRAMS } from './lib/test-fixtures/programs'
import App from './App.svelte'

/**
 * Leaflet mock — same shape as the MapView unit-test mock. Records maps,
 * tile layers and markers (including their popup content) so the parity
 * test can compare the marker set against the table rows without any
 * network access.
 */
const leaflet = vi.hoisted(() => {
  type MockMarker = {
    latlng: [number, number]
    popup: unknown
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
      popup: null,
      onMap: null,
      removed: false,
      addTo(map: unknown) {
        marker.onMap = map
        return marker
      },
      bindPopup(content: unknown) {
        marker.popup = content
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

/**
 * The generator is mocked so App renders the handwritten deterministic
 * fixtures instead of Faker output — the parity assertions below can then
 * name exact program ids.
 */
vi.mock('./lib/data/generate', async () => {
  const { FIXTURE_PROGRAMS } = await import('./lib/test-fixtures/programs')
  return {
    generateHousingPrograms: () => [...FIXTURE_PROGRAMS],
  }
})

const allPrograms = FIXTURE_PROGRAMS

/**
 * Live markers on the current map, resolved back to program ids through
 * their popup text (the program name). Ids — never coordinates — are the
 * identity channel: the fixtures deliberately include coincident points,
 * so a lat/lng key would be ambiguous.
 */
function liveMarkerIds(): string[] {
  const map = leaflet.state.maps.at(-1)
  const nameToId = new Map(allPrograms.map((p) => [p.programName, p.id]))
  return leaflet.state.markers
    .filter((m) => m.onMap === map && !m.removed)
    .map((m) => {
      const popup = m.popup as HTMLElement | null
      const name = popup?.querySelector('strong')?.textContent ?? ''
      const id = nameToId.get(name)
      if (id === undefined) {
        throw new Error(`Marker popup does not match any fixture program: "${name}"`)
      }
      return id
    })
}

/** Program rows in the table body (the empty-state row carries no data-id). */
function tableRowIds(): string[] {
  const table = screen.getByRole('table')
  return within(table)
    .getAllByRole('row')
    .map((row) => row.getAttribute('data-id'))
    .filter((id): id is string => id !== null)
}

function badgeCount(): number {
  const badge = screen.getByText(/\d+ programs?/)
  return Number(badge.textContent!.match(/\d+/)![0])
}

/**
 * THE parity assertion: marker id set === table row id set === badge count.
 * Ids and counts are compared — never addresses or coordinates.
 */
function expectParity(expected: readonly HousingProgram[]): void {
  const expectedIds = new Set(expected.map((p) => p.id))
  const markerIds = liveMarkerIds()
  const rowIds = tableRowIds()

  expect(new Set(markerIds)).toEqual(expectedIds)
  expect(markerIds).toHaveLength(expected.length)
  expect(new Set(rowIds)).toEqual(expectedIds)
  expect(rowIds).toHaveLength(expected.length)
  expect(badgeCount()).toBe(expected.length)
}

function checkbox(label: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name: label }) as HTMLInputElement
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

/**
 * jsdom sanitizes number-input values mid-typing, so completed entries are
 * simulated directly — the same sequence a real blur/Enter produces.
 */
async function commitBeds(value: string): Promise<void> {
  const input = screen.getByLabelText('Minimum beds / units')
  await fireEvent.input(input, { target: { value } })
  await fireEvent.change(input)
}

afterEach(() => {
  leaflet.state.maps.length = 0
  leaflet.state.tileLayers.length = 0
  leaflet.state.markers.length = 0
})

describe('App integration', () => {
  it('renders the persistent synthetic-data notice', async () => {
    await render(App)

    expect(
      screen.getByText(/Synthetic housing-program examples using real provider names\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Discovery only — not eligibility determination or verified availability\./),
    ).toBeInTheDocument()
  })

  it('renders the filter panel, count badge, map and program table', async () => {
    await render(App)

    expect(screen.getByRole('group', { name: 'Classification' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search programs')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText(/\d+ programs?/)).toBeInTheDocument()
    expect(leaflet.state.maps).toHaveLength(1)
    expect(leaflet.state.tileLayers[0]!.url).toContain('openstreetmap.org')
  })

  it('starts in parity: badge, table rows and markers all show every program', async () => {
    await render(App)

    expectParity(allPrograms)
  })

  it('stays in parity after one classification filter', async () => {
    await render(App)
    expect(badgeCount()).toBe(allPrograms.length)

    await userEvent.click(checkbox('Verified reentry housing'))

    // Filter wiring through the real store: panel → state → table, map, badge.
    const verified = allPrograms.filter((p) => p.classification === 'VERIFIED REENTRY HOUSING')
    expect(verified.length).toBeGreaterThan(0)
    expect(verified.length).toBeLessThan(allPrograms.length)
    expect(badgeCount()).toBe(verified.length)
    expectParity(verified)
  })

  it('stays in parity with combined filters across two dimensions', async () => {
    await render(App)

    // AND across dimensions, OR within: 'all-genders' matches a Men
    // selection and 'both' matches a Families selection, so exactly the
    // fx-01/fx-04/fx-09/fx-13 fixtures survive.
    await userEvent.click(checkbox('Men'))
    await userEvent.click(checkbox('Families'))

    const expected = allPrograms.filter((p) =>
      ['fx-01', 'fx-04', 'fx-09', 'fx-13'].includes(p.id),
    )
    expect(expected).toHaveLength(4)
    expectParity(expected)
  })

  it('stays in parity after a search', async () => {
    await render(App)

    await typeAndCommit(screen.getByLabelText('Search programs'), 'shelter')

    // Matches fx-03 ('Family Emergency Shelter') and fx-12 ('Shelter &
    // Transitional Services (SOME)') by program name.
    const expected = allPrograms.filter((p) => ['fx-03', 'fx-12'].includes(p.id))
    expect(expected).toHaveLength(2)
    expectParity(expected)
  })

  it('keeps previously committed results while the draft is invalid', async () => {
    await render(App)

    await userEvent.click(checkbox('Verified reentry housing'))
    const verified = allPrograms.filter((p) => p.classification === 'VERIFIED REENTRY HOUSING')
    expectParity(verified)

    // A non-integer minimum never commits: the previously committed filter —
    // and therefore the table, map and badge — stay untouched.
    await commitBeds('1.5')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expectParity(verified)
  })

  it('restores full parity after reset', async () => {
    await render(App)

    await userEvent.click(checkbox('Verified reentry housing'))
    expectParity(allPrograms.filter((p) => p.classification === 'VERIFIED REENTRY HOUSING'))

    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))

    expectParity(allPrograms)
  })

  it('shows a zero-result state: badge 0, empty table row, no markers', async () => {
    await render(App)

    // No fixture has 1000 or more beds/units, so this minimum guarantees an
    // empty result set.
    await commitBeds('1000')

    expectParity([])
    expect(badgeCount()).toBe(0)
    expect(screen.getByText('0 programs')).toBeInTheDocument()
    expect(screen.getByText('No programs match the current filters.')).toBeInTheDocument()
  })
})
