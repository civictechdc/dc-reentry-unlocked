import { act, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { House } from '../types'
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
    mergedIconOptions: null as Record<string, unknown> | null,
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
    Icon: {
      Default: {
        mergeOptions(options: Record<string, unknown>) {
          state.mergedIconOptions = options
        },
      },
    },
  }

  return { L, state }
})

vi.mock('leaflet', () => ({ default: leaflet.L }))

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
  {
    id: 'h-0003',
    address: '300 Pine Rd, Washington, DC',
    lat: 38.89,
    lon: -76.99,
    price: 700_000,
    bedrooms: 2,
    bathrooms: 1.5,
    sqft: 900,
    type: 'condo',
  },
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
  leaflet.state.mergedIconOptions = null
})

describe('MapView', () => {
  it('creates the map once on mount with an OSM tile layer and attribution', async () => {
    await render(MapView, { props: { houses } })

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

  it('fixes the default marker icon assets via L.Icon.Default.mergeOptions', async () => {
    await render(MapView, { props: { houses } })

    expect(leaflet.state.mergedIconOptions).toEqual(
      expect.objectContaining({
        iconUrl: expect.any(String),
        iconRetinaUrl: expect.any(String),
        shadowUrl: expect.any(String),
      }),
    )
  })

  it('adds one marker per initial house with a text-only popup', async () => {
    await render(MapView, { props: { houses } })

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
    expect((popup as HTMLElement).textContent).toContain('100 Oak St, Washington, DC')
    // Data must be inserted via textContent, never HTML strings.
    expect((popup as HTMLElement).querySelector('img')).toBeNull()
  })

  it('reconciles markers when the houses prop changes (adds, removes, retains)', async () => {
    const { rerender } = await render(MapView, { props: { houses } })
    expect(liveMarkers()).toHaveLength(3)

    const retainedBefore = liveMarkers().slice(0, 2)

    const subset = houses.slice(0, 2)
    await rerender({ houses: subset })

    // Same map instance — no recreation on filter changes.
    expect(leaflet.state.maps).toHaveLength(1)
    const markers = liveMarkers()
    expect(markers).toHaveLength(2)
    expect(markers.map((m) => m.latlng)).toEqual(
      expect.arrayContaining([
        [38.9, -76.98],
        [38.91, -76.97],
      ]),
    )
    // Retention, not recreation: the retained markers are the SAME instances
    // (a remove-all-then-readd implementation would create new ones here).
    expect(leaflet.state.markers).toHaveLength(3)
    expect(markers[0]).toBe(retainedBefore[0])
    expect(markers[1]).toBe(retainedBefore[1])
    // The removed house's marker was removed, not left behind.
    const removedMarker = leaflet.state.markers.find((m) => m.latlng[0] === 38.89)
    expect(removedMarker?.removed).toBe(true)
  })

  it('handles an empty house list without markers or fitBounds', async () => {
    await render(MapView, { props: { houses: [] } })

    expect(liveMarkers()).toHaveLength(0)
    expect(leaflet.state.fitBoundsCalls).toHaveLength(0)
    // Falls back to the DC overview.
    expect(leaflet.state.setViewCalls.length).toBeGreaterThan(0)
    expect(leaflet.state.setViewCalls[0]!.center).toEqual([38.9, -76.98])
  })

  it('fits bounds with padding and a max zoom when houses exist', async () => {
    await render(MapView, { props: { houses } })

    expect(leaflet.state.fitBoundsCalls).toHaveLength(1)
    expect(leaflet.state.fitBoundsCalls[0]!.options).toEqual(
      expect.objectContaining({ maxZoom: 15, padding: expect.anything() }),
    )
  })

  it('shows a warning banner on tile errors and stays functional', async () => {
    await render(MapView, { props: { houses } })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    const onTileError = leaflet.state.tileErrorCallbacks[0]
    expect(onTileError).toBeTypeOf('function')
    await act(() => {
      onTileError!()
    })

    expect(screen.getByRole('status')).toHaveTextContent(/tiles failed to load/i)
  })

  it('removes the map on unmount', async () => {
    const { unmount } = await render(MapView, { props: { houses } })
    const map = leaflet.state.maps[0]!

    unmount()

    expect(map.removed).toBe(true)
  })
})
