<script lang="ts">
  import type { House } from '../types'

  let { houses }: { houses: readonly House[] } = $props()

  const priceFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
</script>

<div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th scope="col">Address</th>
        <th scope="col">Price</th>
        <th scope="col">Beds</th>
        <th scope="col">Baths</th>
        <th scope="col">Sqft</th>
        <th scope="col">Type</th>
      </tr>
    </thead>
    <tbody>
      {#each houses as h (h.id)}
        <tr>
          <td>{h.address}</td>
          <td>{priceFmt.format(h.price)}</td>
          <td>{h.bedrooms}</td>
          <td>{h.bathrooms}</td>
          <td>{h.sqft}</td>
          <td>{h.type}</td>
        </tr>
      {:else}
        <tr class="empty-row">
          <td colspan="6">No houses match the current filters.</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
