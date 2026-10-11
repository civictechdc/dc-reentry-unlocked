<script lang="ts">
  import { onMount } from 'svelte'
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
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

  /** Solid location-pin marker inlined as a red SVG data URI — no image
   * assets, so bundler URL issues cannot break it. Pin tip sits at (12, 21)
   * in the 24-unit viewBox, scaled to 32px. */
  const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#dc2626" d="M17.8 13.938h-.011a7 7 0 1 0-11.464.144h-.016l.14.171c.1.127.2.251.3.371L12 21l5.13-6.248c.194-.209.374-.429.54-.659l.13-.155Z"/><path fill="#ffffff" d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>`

  const markerIcon = L.icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MARKER_SVG)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 28],
    popupAnchor: [0, -6],
  })

  onMount(() => {
    if (!container) return

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
        const marker = L.marker([p.lat, p.lon], { icon: markerIcon }).addTo(map)
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
