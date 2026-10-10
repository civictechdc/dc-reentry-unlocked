<script lang="ts">
  import { onMount } from 'svelte'
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
  import markerIcon from 'leaflet/dist/images/marker-icon.png'
  import markerShadow from 'leaflet/dist/images/marker-shadow.png'
  import type { House } from '../types'

  let { houses }: { houses: readonly House[] } = $props()

  const DC_CENTER: [number, number] = [38.9, -76.98]
  const DC_ZOOM = 12

  let container: HTMLDivElement | undefined
  let map: L.Map | null = null
  let ready = $state(false)
  let tileError = $state(false)

  /** ID-keyed marker registry so prop changes only add/remove the delta. */
  const markers = new Map<string, L.Marker>()

  const priceFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

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
  function popupContent(h: House): HTMLElement {
    const el = document.createElement('div')
    const address = document.createElement('strong')
    address.textContent = h.address
    const details = document.createElement('div')
    details.textContent = `${h.bedrooms} bd · ${h.bathrooms} ba · ${h.sqft} sqft · ${h.type}`
    const price = document.createElement('div')
    price.textContent = priceFmt.format(h.price)
    el.append(address, details, price)
    return el
  }

  function reconcile(list: readonly House[]): void {
    if (!map) return

    const ids = new Set(list.map((h) => h.id))
    for (const [id, marker] of markers) {
      if (!ids.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
    for (const h of list) {
      if (!markers.has(h.id)) {
        const marker = L.marker([h.lat, h.lon]).addTo(map)
        marker.bindPopup(popupContent(h))
        markers.set(h.id, marker)
      }
    }

    if (list.length > 0) {
      const bounds = L.latLngBounds(list.map((h) => [h.lat, h.lon] as [number, number]))
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    } else {
      map.setView(DC_CENTER, DC_ZOOM)
    }
  }

  // Reconcile markers whenever the filtered house list or map readiness
  // changes; the map itself is never recreated.
  $effect(() => {
    if (!ready || !map) return
    reconcile(houses)
  })
</script>

<div class="map-view">
  {#if tileError}
    <p class="map-warning" role="status">
      Map tiles failed to load — the list below still works.
    </p>
  {/if}
  <div class="map-container" bind:this={container} role="region" aria-label="Map of houses"></div>
</div>
