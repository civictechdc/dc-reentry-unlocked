<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";
  import { detailValueLabel, roomTypeDetailLabel } from "./detail-values.ts";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /**
   * Unit detail slide-over: opened by selecting a card or map pin while the
   * map stays visible; closing returns to the list in its prior state.
   * Unknown policy fields render the honest "not publicly listed" — never
   * a fabricated value.
   */
  const unit = $derived(store.units?.find((card) => card.id === uiState.selectedUnitId) ?? null);
  const hasSelection = $derived(uiState.selectedUnitId !== null);
  let panel: HTMLElement | undefined = $state();

  $effect(() => {
    if (hasSelection && panel) panel.focus();
  });

  // Contentless-panel edge: a selection that left the current result set
  // (filters narrowed, list reloaded) closes the panel instead of showing
  // an empty shell.
  $effect(() => {
    if (hasSelection && store.units !== null && unit === null) {
      close();
    }
  });

  function close(): void {
    uiState.selectedUnitId = null;
    uiState.hoveredPinUnitId = null;
    uiState.hoveredCardUnitId = null;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (hasSelection && event.key === "Escape") {
      close();
    }
  }

  const specRows = $derived.by(() => {
    if (!unit) return [];
    return [
      { label: m.detail_address(), value: unit.address },
      { label: m.detail_bedrooms(), value: m.detail_bedrooms_value({ bedrooms: unit.bedrooms }) },
      { label: m.detail_size(), value: m.detail_size_value({ squareFeet: unit.size.squareFeet }) },
      { label: m.card_room_type(), value: roomTypeDetailLabel(unit.size.roomType) },
      { label: m.detail_cost(), value: m.detail_cost_value({ cost: unit.cost }) },
      { label: m.detail_ward(), value: m.card_ward({ ward: unit.ward }) },
    ];
  });

  const policyRows = $derived.by(() => {
    if (!unit) return [];
    const p = unit.program;
    return [
      { label: m.detail_policy_referral(), value: detailValueLabel(p.referralRequired) },
      { label: m.detail_policy_sobriety(), value: detailValueLabel(p.sobrietyRequired) },
      {
        label: m.detail_policy_background_check(),
        value: detailValueLabel(p.backgroundCheckRequired),
      },
      { label: m.detail_policy_sex_offense(), value: detailValueLabel(p.sexOffenseRestrictions) },
      { label: m.detail_policy_treatment(), value: detailValueLabel(p.treatmentRequired) },
      { label: m.detail_policy_vouchers(), value: detailValueLabel(p.housingVouchersAccepted) },
      { label: m.detail_policy_housing_type(), value: detailValueLabel(p.housingType) },
      { label: m.detail_policy_length(), value: detailValueLabel(p.lengthOfStay) },
      { label: m.detail_policy_population(), value: detailValueLabel(p.population) },
      { label: m.detail_policy_gender(), value: detailValueLabel(p.gender) },
    ];
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if hasSelection}
  <aside
    bind:this={panel}
    tabindex="-1"
    class="detail"
    aria-label={m.detail_specs_title()}
    data-testid="unit-detail"
  >
    <div class="detail-head">
      {#if unit}
        <h2>{unit.program.name}</h2>
      {/if}
      <button type="button" class="close" onclick={close}>{m.detail_close()}</button>
    </div>
    {#if unit}
      <section class="detail-section" aria-label={m.detail_specs_title()}>
        <h3>{m.detail_specs_title()}</h3>
        <dl>
          {#each specRows as row (row.label)}
            <div class="row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          {/each}
        </dl>
      </section>
      <section class="detail-section" aria-label={m.detail_policies_title()}>
        <h3>{m.detail_policies_title()}</h3>
        <dl>
          {#each policyRows as row (row.label)}
            <div class="row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          {/each}
        </dl>
      </section>
      <section class="detail-section" aria-label={m.detail_contact_title()}>
        <h3>{m.detail_contact_title()}</h3>
        <dl>
          <div class="row">
            <dt>{m.detail_contact_organization()}</dt>
            <dd>{unit.provider.organization}</dd>
          </div>
          <div class="row">
            <dt>{m.detail_contact_program()}</dt>
            <dd>{unit.program.name}</dd>
          </div>
          <div class="row">
            <dt>{m.detail_contact_phone()}</dt>
            <dd>{unit.provider.phone ?? m.detail_contact_no_details()}</dd>
          </div>
          <div class="row">
            <dt>{m.detail_contact_email()}</dt>
            <dd>
              {#if unit.provider.email}
                <a href={`mailto:${unit.provider.email}`}>{unit.provider.email}</a>
              {:else}
                {m.detail_contact_no_details()}
              {/if}
            </dd>
          </div>
          <div class="row">
            <dt>{m.detail_contact_website()}</dt>
            <dd>
              {#if unit.provider.website}
                <a href={unit.provider.website} rel="noreferrer">{unit.provider.website}</a>
              {:else}
                {m.detail_contact_no_details()}
              {/if}
            </dd>
          </div>
          <div class="row">
            <dt>{m.detail_contact_application()}</dt>
            <dd>{unit.program.applicationProcess ?? m.detail_contact_no_details()}</dd>
          </div>
        </dl>
      </section>
    {/if}
  </aside>
{/if}

<style>
  .detail {
    position: absolute;
    inset-block: 0;
    right: 0;
    width: min(26rem, 100%);
    max-height: 100%;
    overflow-y: auto;
    background: var(--surface-raised);
    border-left: 1px solid var(--line);
    box-shadow: var(--shadow);
    padding: 1rem;
    z-index: 30;
  }
  /* Phone width: the same slide-over renders as a full-screen bottom sheet. */
  @media (max-width: 768px) {
    .detail {
      position: fixed;
      inset: auto 0 0 0;
      width: 100%;
      max-height: 100vh;
      border-left: 0;
      border-top: 1px solid var(--line);
      border-radius: 12px 12px 0 0;
    }
  }
  .detail-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .close {
    font: inherit;
    border: 1px solid var(--line-strong);
    background: var(--surface-raised);
    color: var(--ink);
    border-radius: var(--radius);
    padding: 0.25rem 0.6rem;
  }
  .detail-section {
    margin-top: 1rem;
  }
  h3 {
    font-size: 0.9rem;
    margin: 0 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
  dl {
    margin: 0;
    display: grid;
    gap: 0.35rem;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(9rem, max-content) 1fr;
    gap: 0.75rem;
    font-size: 0.9rem;
    border-bottom: 1px dashed var(--line);
    padding-bottom: 0.3rem;
  }
  .row dt {
    color: var(--ink-muted);
  }
  .row dd {
    margin: 0;
  }
</style>
