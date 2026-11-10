<script lang="ts">
  import type { UnitCard } from "@dc-reentry/shared";
  import { m } from "#lib/paraglide/messages.js";
  import { cardBedroomsValue, detailValueLabel } from "./detail-values.ts";
  import { uiState } from "#lib/state/ui-state.svelte.ts";

  let {
    card,
    selected = false,
  }: {
    card: UnitCard;
    selected?: boolean;
  } = $props();

  /** One card: unit specs + provider/program identity + verification badge. */
  const isHighlighted = $derived(
    uiState.hoveredCardUnitId === card.id || uiState.hoveredPinUnitId === card.id,
  );
  const isOpen = $derived(uiState.selectedUnitId === card.id);
  const housingTypeLabel = $derived(detailValueLabel(card.program.housingType));
  const badgeLabel = $derived(
    card.verificationBadge === "confirmed"
      ? m.card_badge_confirmed()
      : m.card_badge_needs_verification(),
  );

  function selectCard(event: MouseEvent): void {
    // Remember the activating button: closing the detail hands keyboard focus
    // back to this control while it is still in the DOM.
    uiState.detailTriggerElement =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    // Card selection supersedes any earlier canvas-pin hover identity: the
    // selected unit owns the label fallback, so a stale pin hover id from a
    // previous canvas pin click must not outlive this selection.
    uiState.hoveredPinUnitId = null;
    uiState.selectedUnitId = card.id;
  }
</script>

<article
  class="unit-card"
  class:selected={selected || isOpen}
  class:highlighted={isHighlighted}
  aria-labelledby={`card-title-${card.id}`}
>
  <button
    type="button"
    class="card-body"
    onclick={selectCard}
    onpointerenter={() => (uiState.hoveredCardUnitId = card.id)}
    onpointerleave={() => (uiState.hoveredCardUnitId = null)}
    onfocus={() => (uiState.hoveredCardUnitId = card.id)}
    onblur={() => (uiState.hoveredCardUnitId = null)}
    aria-expanded={isOpen}
  >
    <div class="card-head">
      <h2 id={`card-title-${card.id}`}>
        <span class="program-name">{card.program.name}</span>
        <span class="provider">{card.provider.organization}</span>
      </h2>
      <span class={`badge badge-${card.verificationBadge}`}>{badgeLabel}</span>
    </div>
    <dl class="specs">
      <div>
        <dt class="sr-only">{m.detail_bedrooms()}</dt>
        <dd>{cardBedroomsValue(card.bedrooms, card.size.roomType)}</dd>
      </div>
      <div>
        <dt class="sr-only">{m.detail_ward()}</dt>
        <dd>{m.card_ward({ ward: card.ward })}</dd>
      </div>
      <div>
        <dt class="sr-only">{m.detail_cost()}</dt>
        <dd>{m.card_cost({ cost: card.cost })}</dd>
      </div>
      <div>
        <dt class="sr-only">{m.detail_policy_housing_type()}</dt>
        <dd>{m.card_housing_type({ type: housingTypeLabel })}</dd>
      </div>
    </dl>
  </button>
</article>

<style>
  .unit-card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-raised);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .unit-card.selected,
  .unit-card.highlighted {
    border-color: var(--accent);
    outline: 2px solid var(--accent);
  }
  .card-body {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    text-align: left;
    font: inherit;
    border: 0;
    background: transparent;
    color: var(--ink);
  }
  .card-head {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    align-items: flex-start;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    display: grid;
  }
  .provider {
    font-weight: 400;
    font-size: 0.875rem;
    color: var(--ink-muted);
  }
  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  .badge-confirmed {
    background: var(--badge-confirmed-bg);
    color: var(--badge-confirmed-ink);
  }
  .badge-needs-verification {
    background: var(--badge-unverified-bg);
    color: var(--badge-unverified-ink);
  }
  .specs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
  }
  .specs div {
    margin: 0;
  }
  .specs dd {
    margin: 0;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
