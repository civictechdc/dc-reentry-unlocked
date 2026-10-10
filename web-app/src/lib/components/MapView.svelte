<script lang="ts">
  import { onMount } from 'svelte'
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
  import markerIcon from 'leaflet/dist/images/marker-icon.png'
  import markerShadow from 'leaflet/dist/images/marker-shadow.png'
  import type { HousingProgram } from '../types'
  import { CLASSIFICATION_LABELS, formatBedsUnits } from '../labels'

  let { programs }: { programs: readonly HousingProgram[] } = $props()

  const DC_CENTER: [number, number] = [38.9, -76.98]
  const DC_ZOOM = 12

  let container: HTMLDivElement | undefined
  let map: L.Map | null = null
  let ready = $state(false)
  let tileError = $state(false)

  /** ID-keyed marker registry so prop changes only add/remove the delta.
   * Keyed by program id — never by coordinates — so coincident programs
   * (same lat/lon) each get their own marker. */
  const markers = new Map<string, L.Marker>()

  onMount(() => {
    if (!container) return

    // Bundlers break Leaflet's default relative icon URLs; point them at
    // Vite-resolved asset URLs instead.
    L.Icon.Default.mergeOptions({
      iconUrl: markerIcon,
      iconRetinaUrl: markerIcon2x,
      shadowUrl: markerShadow,
    })

    map = L.map(container, { center: DC_CENTER, zoom: DC_ZOOM })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
      .on('tileerror', () => {
        tileError = true
      })
      .addTo(map)

    ready = true

    return () => {
      map?.remove()
      map = null
      markers.clear()
    }
  })

  /** Popup content is built with DOM APIs and textContent only — never HTML
   * strings assembled from data. */
  function popupContent(p: HousingProgram): HTMLElement {
    const el = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = p.programName
    const provider = document.createElement('div')
    provider.textContent = p.provider
    const classification = document.createElement('div')
    classification.textContent = CLASSIFICATION_LABELS[p.classification]
    const rent = document.createElement('div')
    rent.textContent = p.rentCostText ?? 'Rent / cost not listed'
    const beds = document.createElement('div')
    beds.textContent = `Vacant beds / units: ${formatBedsUnits(p)}`
    const address = document.createElement('div')
    address.textContent = p.address
    const caveat = document.createElement('div')
    caveat.textContent = 'Simulated example — address is an unrelated sample, not a program location.'
    el.append(name, provider, classification, rent, beds, address, caveat)
    return el
  }

  function reconcile(list: readonly HousingProgram[]): void {
    if (!map) return

    const ids = new Set(list.map((p) => p.id))
    for (const [id, marker] of markers) {
      if (!ids.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
    for (const p of list) {
      if (!markers.has(p.id)) {
        const marker = L.marker([p.lat, p.lon]).addTo(map)
        marker.bindPopup(popupContent(p))
        markers.set(p.id, marker)
      }
    }

    if (list.length > 0) {
      const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lon] as [number, number]))
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    } else {
      map.setView(DC_CENTER, DC_ZOOM)
    }
  }

  // Reconcile markers whenever the filtered program list or map readiness
  // changes; the map itself is never recreated.
  $effect(() => {
    if (!ready || !map) return
    reconcile(programs)
  })
</script>

<div class="map-view">
  {#if tileError}
    <p class="map-warning" role="status">
      Map tiles failed to load — the list below still works.
    </p>
  {/if}
  <div class="map-container" bind:this={container} role="region" aria-label="Map of programs"></div>
</div>
