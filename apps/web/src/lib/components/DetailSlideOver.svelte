<script lang="ts">
  import { untrack } from "svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { housingStore, type HousingStore } from "#lib/state/housing-store.svelte.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";
  import {
    detailBedroomsValue,
    detailValueLabel,
    roomTypeDetailLabel,
    telHref,
  } from "./detail-values.ts";

  let { store = housingStore }: { store?: HousingStore } = $props();

  /**
   * Unit detail slide-over: opened by selecting a card or map pin while the
   * map stays visible; closing returns to the list in its prior state.
   * Unknown policy fields render the honest "Unknown" — never
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

  /**
   * Closing hands keyboard focus back to the control that opened the detail
   * (card or pin button) instead of dropping it to the page — but only while
   * that control is still in the DOM; a stale trigger (its card left the
   * result set) is dropped and focus stays where the browser put it. Focus
   * restoration completes the close's dismissal: the opener's own focus
   * handler re-lights its hover slot (and with it the address label), so the
   * hover state is cleared again right after `focus()` — a close fully
   * dismisses on every path, and a later genuine focus event lights the
   * label normally. One close edge covers every close path: close button,
   * Escape, canvas click-off, and the contentless-panel close above.
   */
  let hadSelection = false;
  $effect(() => {
    const hasPanel = hasSelection;
    const closedJustNow = hadSelection && !hasPanel;
    hadSelection = hasPanel;
    if (closedJustNow) {
      untrack(() => {
        const trigger = uiState.detailTriggerElement;
        if (trigger && document.contains(trigger)) trigger.focus();
        uiState.hoveredCardUnitId = null;
        uiState.detailTriggerElement = null;
      });
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
      { label: m.detail_bedrooms(), value: detailBedroomsValue(unit.bedrooms, unit.size.roomType) },
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
      <button type="button" class="close" aria-label={m.detail_close()} onclick={close}>×</button>
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
            <dd>
              {#if unit.provider.phone}
                <a href={telHref(unit.provider.phone)}>{unit.provider.phone}</a>
              {:else}
                {m.detail_contact_no_details()}
              {/if}
            </dd>
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
    background: var(--color-surface-raised);
    border-left: 1px solid var(--color-line);
    box-shadow: var(--shadow);
    padding: var(--spacing-lg);
    z-index: 30;
  }
  /* Phone width: the same slide-over renders as a full-screen bottom sheet.
     Tracks the tabbed-form breakpoint exactly (899.98 = 900px boundary,
     desktop owns 900) — a wider gap would leave in-between widths a tabbed
     list with a desktop slide-over. */
  @media (max-width: 899.98px) {
    .detail {
      position: fixed;
      inset: auto 0 0 0;
      width: 100%;
      max-height: 100vh;
      border-left: 0;
      border-top: 1px solid var(--color-line);
      border-radius: 12px 12px 0 0;
    }
  }
  .detail-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .close {
    font: inherit;
    line-height: 1;
    border: 1px solid var(--color-close);
    background: var(--color-close);
    color: var(--color-ink-on-close);
    border-radius: var(--rounded-control);
    padding: 0.25rem 0.6rem;
  }
  .detail-section {
    margin-top: var(--spacing-lg);
  }
  h3 {
    font-size: 0.9rem;
    margin: 0 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-muted);
  }
  dl {
    margin: 0;
    display: grid;
    gap: 0.35rem;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(9rem, max-content) 1fr;
    gap: var(--spacing-md);
    font-size: 0.9rem;
    border-bottom: 1px dashed var(--color-line);
    padding-bottom: 0.3rem;
  }
  .row dt {
    color: var(--color-ink-muted);
  }
  .row dd {
    margin: 0;
  }
</style>
