import { act, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HousingProgram } from '../types'
import MapView from './MapView.svelte'

/**
 * Leaflet is fully mocked: no network, no real map. `state` records every
 * call the component makes so tests can assert on map/tile/marker behavior.
 */
const leaflet = vi.hoisted(() => {
  type MockMarker = {
    latlng: [number, number]
    options: Record<string, unknown>
    popup: unknown
    onMap: unknown
    removed: boolean
    addTo: (map: unknown) => MockMarker
    bindPopup: (content: unknown) => MockMarker
    remove: () => void
  }

  const state = {
    maps: [] as {
      options: Record<string, unknown>
      removed: boolean
      fitBounds: (b: unknown, o: unknown) => void
      setView: (c: unknown, z: unknown) => void
      remove: () => void
    }[],
    tileLayers: [] as { url: string; options: Record<string, unknown> }[],
    markers: [] as MockMarker[],
    fitBoundsCalls: [] as { bounds: unknown; options: unknown }[],
    setViewCalls: [] as { center: unknown; zoom: unknown }[],
    tileErrorCallbacks: [] as (() => void)[],
  }

  function createMarker(latlng: [number, number], options?: Record<string, unknown>): MockMarker {
    const marker: MockMarker = {
      latlng,
      options: options ?? {},
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
    map(_container: unknown, options?: Record<string, unknown>) {
      const map = {
        options: options ?? {},
        removed: false,
        fitBounds(bounds: unknown, opts: unknown) {
          state.fitBoundsCalls.push({ bounds, options: opts })
        },
        setView(center: unknown, zoom: unknown) {
          state.setViewCalls.push({ center, zoom })
        },
        remove() {
          map.removed = true
        },
      }
      state.maps.push(map)
      return map
    },
    tileLayer(url: string, options?: Record<string, unknown>) {
      const layer = {
        url,
        options: options ?? {},
        on(event: string, cb: () => void) {
          if (event === 'tileerror') state.tileErrorCallbacks.push(cb)
          return layer
        },
        addTo(map: unknown) {
          return layer
        },
      }
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
  }

  return { L, state }
})

vi.mock('leaflet', () => ({ default: leaflet.L }))

/** Deterministic HousingProgram factory; overrides replace any field. */
function program(overrides: Partial<HousingProgram> & Pick<HousingProgram, 'id'>): HousingProgram {
  return {
    provider: 'Test Provider Org',
    programName: `Program ${overrides.id}`,
    housingCategories: ['transitional'] as const,
    classification: 'VERIFIED REENTRY HOUSING',
    wardsServed: [1] as const,
    genderServed: 'men',
    householdType: 'individuals',
    populationServed: null,
    rentCostText: 'Income-based rent',
    rentCostCategory: 'income-based',
    bedsUnitsText: '12 beds',
    bedsUnits: 12,
    address: '100 Test St, Washington, DC',
    lat: 38.9,
    lon: -76.98,
    phone: null,
    email: null,
    website: null,
    programUrl: null,
    ...overrides,
  }
}

const programs: HousingProgram[] = [
  program({ id: 'p-0001', lat: 38.9, lon: -76.98 }),
  program({ id: 'p-0002', lat: 38.91, lon: -76.97 }),
  program({ id: 'p-0003', lat: 38.89, lon: -76.99 }),
]

/** Live (added to the map, not removed) markers. */
function liveMarkers() {
  const map = leaflet.state.maps.at(-1)
  return leaflet.state.markers.filter((m) => m.onMap === map && !m.removed)
}

afterEach(() => {
  leaflet.state.maps.length = 0
  leaflet.state.tileLayers.length = 0
  leaflet.state.markers.length = 0
  leaflet.state.fitBoundsCalls.length = 0
  leaflet.state.setViewCalls.length = 0
  leaflet.state.tileErrorCallbacks.length = 0
})

describe('MapView', () => {
  it('creates the map once on mount with an OSM tile layer and attribution', async () => {
    await render(MapView, { props: { programs } })

    expect(leaflet.state.maps).toHaveLength(1)
    // The map is created centered on D.C. at the overview zoom.
    expect(leaflet.state.maps[0]!.options).toEqual(
      expect.objectContaining({ center: [38.9, -76.98], zoom: 12 }),
    )
    expect(leaflet.state.tileLayers).toHaveLength(1)
    expect(leaflet.state.tileLayers[0]!.url).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    )
    expect(String(leaflet.state.tileLayers[0]!.options.attribution)).toContain(
      'OpenStreetMap contributors',
    )
  })

  it('renders each marker with the red SVG pin icon', async () => {
    await render(MapView, { props: { programs } })

    const markers = liveMarkers()
    expect(markers).toHaveLength(3)
    for (const marker of markers) {
      const icon = marker.options.icon as Record<string, unknown>
      // Inline SVG data URI — no bundled image assets to break.
      expect(String(icon.iconUrl)).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
      // Solid red pin body (#dc2626) with a white inner dot.
      const svg = decodeURIComponent(String(icon.iconUrl))
      expect(svg).toContain('fill="#dc2626"')
      expect(svg).toContain('fill="#ffffff"')
      expect(icon.iconSize).toEqual([32, 32])
      expect(icon.iconAnchor).toEqual([16, 28])
    }
  })

  it('adds one marker per initial program with a text-only popup', async () => {
    await render(MapView, { props: { programs } })

    const markers = liveMarkers()
    expect(markers).toHaveLength(3)
    expect(markers.map((m) => m.latlng)).toEqual(
      expect.arrayContaining([
        [38.9, -76.98],
        [38.91, -76.97],
        [38.89, -76.99],
      ]),
    )

    const popup = markers[0]!.popup
    expect(popup).toBeInstanceOf(HTMLElement)
    expect((popup as HTMLElement).textContent).toContain('Program p-0001')
    // Data must be inserted via textContent, never HTML strings.
    expect((popup as HTMLElement).querySelector('img')).toBeNull()
    expect((popup as HTMLElement).querySelector('script')).toBeNull()
  })

  it('builds popup content from program fields, including the caveat line', async () => {
    await render(MapView, { props: { programs: [programs[0]!] } })

    const popup = liveMarkers()[0]!.popup as HTMLElement
    expect(popup.textContent).toContain('Program p-0001')
    expect(popup.textContent).toContain('Test Provider Org')
    expect(popup.textContent).toContain('Verified reentry housing')
    expect(popup.textContent).toContain('Income-based rent')
    expect(popup.textContent).toContain('Vacant beds / units: 12 (12 beds)')
    expect(popup.textContent).toContain('100 Test St, Washington, DC')
    expect(popup.textContent).toContain('Simulated example — address is an unrelated sample, not a program location.')
  })

  it('falls back in the popup when rent and bed text are not listed', async () => {
    const unlisted = program({
      id: 'p-0009',
      rentCostText: null,
      bedsUnitsText: null,
      bedsUnits: 7,
    })
    await render(MapView, { props: { programs: [unlisted] } })

    const popup = liveMarkers()[0]!.popup as HTMLElement
    expect(popup.textContent).toContain('Rent / cost not listed')
    expect(popup.textContent).toContain('Vacant beds / units: 7')
  })

  it('creates one marker per program even when coordinates coincide', async () => {
    const coincident = [
      program({ id: 'p-0001', lat: 38.9, lon: -76.98 }),
      program({ id: 'p-0002', lat: 38.9, lon: -76.98, programName: 'Second Program' }),
    ]
    await render(MapView, { props: { programs: coincident } })

    const markers = liveMarkers()
    expect(markers).toHaveLength(2)
    expect(markers.every((m) => m.latlng[0] === 38.9 && m.latlng[1] === -76.98)).toBe(true)
    // Distinct popups — markers are keyed by id, never deduped by coordinate.
    const texts = markers.map((m) => (m.popup as HTMLElement).textContent)
    expect(texts[0]).toContain('Program p-0001')
    expect(texts[1]).toContain('Second Program')
  })

  it('reconciles markers when the programs prop changes (adds, removes, retains)', async () => {
    const { rerender } = await render(MapView, { props: { programs } })
    expect(liveMarkers()).toHaveLength(3)

    const retainedBefore = liveMarkers().slice(0, 2)

    // Remove the third program and add a fourth.
    const next = [
      programs[0]!,
      programs[1]!,
      program({ id: 'p-0004', lat: 38.87, lon: -77.0 }),
    ]
    await rerender({ programs: next })

    // Same map instance — no recreation on filter changes.
    expect(leaflet.state.maps).toHaveLength(1)
    const markers = liveMarkers()
    expect(markers).toHaveLength(3)
    expect(markers.map((m) => m.latlng)).toEqual(
      expect.arrayContaining([
        [38.9, -76.98],
        [38.91, -76.97],
        [38.87, -77.0],
      ]),
    )
    // Retention, not recreation: the retained markers are the SAME instances
    // (a remove-all-then-readd implementation would create new ones here).
    expect(leaflet.state.markers).toHaveLength(4)
    expect(markers[0]).toBe(retainedBefore[0])
    expect(markers[1]).toBe(retainedBefore[1])
    // The removed program's marker was removed, not left behind.
    const removedMarker = leaflet.state.markers.find((m) => m.latlng[0] === 38.89)
    expect(removedMarker?.removed).toBe(true)
  })

  it('handles an empty program list without markers or fitBounds', async () => {
    await render(MapView, { props: { programs: [] } })

    expect(liveMarkers()).toHaveLength(0)
    expect(leaflet.state.fitBoundsCalls).toHaveLength(0)
    // Falls back to the DC overview.
    expect(leaflet.state.setViewCalls.length).toBeGreaterThan(0)
    expect(leaflet.state.setViewCalls[0]!.center).toEqual([38.9, -76.98])
  })

  it('fits bounds with padding and a max zoom when programs exist', async () => {
    await render(MapView, { props: { programs } })

    expect(leaflet.state.fitBoundsCalls).toHaveLength(1)
    expect(leaflet.state.fitBoundsCalls[0]!.options).toEqual(
      expect.objectContaining({ maxZoom: 15, padding: expect.anything() }),
    )
  })

  it('shows a warning banner on tile errors and stays functional', async () => {
    await render(MapView, { props: { programs } })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    const onTileError = leaflet.state.tileErrorCallbacks[0]
    expect(onTileError).toBeTypeOf('function')
    await act(() => {
      onTileError!()
    })

    expect(screen.getByRole('status')).toHaveTextContent(/tiles failed to load/i)
  })

  it('removes the map on unmount', async () => {
    const { unmount } = await render(MapView, { props: { programs } })
    const map = leaflet.state.maps[0]!

    unmount()

    expect(map.removed).toBe(true)
  })
})
