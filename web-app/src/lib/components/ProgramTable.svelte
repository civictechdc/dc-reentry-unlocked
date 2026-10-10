<script lang="ts">
  import type { HousingProgram } from '../types'
  import {
    CLASSIFICATION_LABELS,
    formatBedsUnits,
    formatWardsServed,
    GENDER_SERVED_LABELS,
    HOUSING_CATEGORY_LABELS,
    HOUSEHOLD_TYPE_LABELS,
  } from '../labels'

  let { programs }: { programs: readonly HousingProgram[] } = $props()

  const NOT_LISTED = 'Not listed'
</script>

<div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th scope="col">Provider / program</th>
        <th scope="col">Classification</th>
        <th scope="col">Housing categories</th>
        <th scope="col">Service area</th>
        <th scope="col">Gender served</th>
        <th scope="col">Household type</th>
        <th scope="col">Population served</th>
        <th scope="col">Rent / cost</th>
        <th scope="col">Vacant beds / units</th>
        <th scope="col">Sample address</th>
      </tr>
    </thead>
    <tbody>
      {#each programs as p (p.id)}
        <tr data-id={p.id}>
          <td>
            <strong>{p.programName}</strong>
            <div class="program-provider">{p.provider}</div>
          </td>
          <td>{CLASSIFICATION_LABELS[p.classification]}</td>
          <td>{p.housingCategories.map((c) => HOUSING_CATEGORY_LABELS[c]).join(', ')}</td>
          <td>{formatWardsServed(p.wardsServed)}</td>
          <td>{GENDER_SERVED_LABELS[p.genderServed]}</td>
          <td>{HOUSEHOLD_TYPE_LABELS[p.householdType]}</td>
          <td>{p.populationServed ?? NOT_LISTED}</td>
          <td>{p.rentCostText ?? NOT_LISTED}</td>
          <td>{formatBedsUnits(p)}</td>
          <td>{p.address}</td>
        </tr>
      {:else}
        <tr class="empty-row">
          <td colspan="10">No programs match the current filters.</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<p class="table-footnote">Addresses are unrelated real-DC samples, not program locations.</p>

<style>
  /* Subtle disclaimer under the table: the address column samples real D.C.
     streets that have no relation to the synthetic programs. */
  .table-footnote {
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 0.75rem;
  }
</style>
