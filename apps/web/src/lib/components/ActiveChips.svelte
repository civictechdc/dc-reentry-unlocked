<script lang="ts">
  import { tick, untrack } from "svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { FilterDefinition } from "@dc-reentry/shared";
  import { housingStore } from "#lib/state/housing-store.svelte.ts";
  import { chipsOverflow } from "./chips-overflow.ts";

  let {
    store = housingStore,
    clearAll = true,
    singleRow = false,
    onEmptied,
    onFallbackFocus,
  }: {
    store?: typeof housingStore;
    clearAll?: boolean;
    singleRow?: boolean;
    /** Called when the selection empties through one of this component's controls, or when this component's chip surface unmounts after a removal (results recovered). */
    onEmptied?: () => void;
    /** Called synchronously before a removal when no in-component target can hold focus — the owner focuses a persistent element so focus never sits on the page body during the store refresh. */
    onFallbackFocus?: () => void;
  } = $props();

  /**
   * Active selections as individually removable chips beneath the filter
   * bar, with a clear-all affordance. `singleRow` switches to the bounded
   * one-row presentation used inside a reserved summary band: chips that do
   * not fit the row collapse into a trailing `+N more` trigger that opens a
   * non-modal popover listing every applied chip, and `clearAll` can be
   * turned off there so the band owns the single clear-all control.
   */
  const chips = $derived(
    Object.entries(store.selection).flatMap(([filterId, values]) => {
      const definition = store.filtersSchema.find((candidate) => candidate.id === filterId);
      if (!definition) return [];
      // JSON key encoding: ids and values are schema-published and could
      // carry ":" or quote characters — the pair must stay collision-free.
      return values.map((value) => ({
        filterId,
        value,
        definition,
        key: JSON.stringify([filterId, value]),
      }));
    }),
  );
  const hasAnySelection = $derived(
    Object.values(store.selection).some((values) => values.length > 0),
  );

  function valueLabel(definition: FilterDefinition | undefined, value: string): string {
    if (definition?.control === "boolean") {
      return value === "yes" ? m.filter_boolean_yes() : m.filter_boolean_no();
    }
    return definition?.options?.find((option) => option.value === value)?.label ?? value;
  }

  function chipLabel(definition: FilterDefinition | undefined, value: string): string {
    return m.chip_active_label({
      filter: definition?.label ?? value,
      value: valueLabel(definition, value),
    });
  }

  // --- Overflow measurement -------------------------------------------------
  // The partition math lives in the pure `chipsOverflow` helper; this
  // component only feeds it DOM measurements (widths, gap, clip width).

  // Space the trigger needs beside the last visible chip while it has not
  // rendered yet; replaced by the measured width as soon as it has.
  const TRIGGER_RESERVE_ESTIMATE_PX = 80;

  let anchorEl: HTMLDivElement | undefined = $state();
  let rowEl: HTMLDivElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();
  let triggerEl: HTMLButtonElement | undefined = $state();
  let popoverEl: HTMLDivElement | undefined = $state();

  // Whether the disclosure's controls held focus until a targetless blur:
  // only then can a vanishing disclosure claim the stranded focus.
  let disclosureHadFocus = false;

  let partition = $state({ visibleCount: 0, hiddenCount: 0 });
  let overflowOpen = $state(false);
  let popoverMaxHeightPx = $state(256);

  function measure(): void {
    const row = rowEl;
    if (!singleRow || !row) return;
    // The trigger's own li also carries .chip — it is not a data chip.
    const chipEls = Array.from(row.querySelectorAll<HTMLLIElement>("li.chip:not(.more-trigger)"));
    if (chipEls.length === 0) {
      setPartition({ visibleCount: 0, hiddenCount: 0 });
      return;
    }
    const rects = chipEls.map((chip) => chip.getBoundingClientRect());
    const widths = rects.map((rect) => rect.width);
    // The flex gap comes from the computed style, never from DOM positions —
    // positions of chips past the trigger include its displacement.
    const list = row.querySelector("ul");
    const gap = list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0;
    const triggerWidth = row.querySelector("li.more-trigger")?.getBoundingClientRect().width ?? 0;
    const reserve = triggerWidth > 0 ? gap + triggerWidth : TRIGGER_RESERVE_ESTIMATE_PX;
    setPartition(chipsOverflow(widths, gap, row.clientWidth, reserve));
  }

  /** Identical results never write, so measurement cannot loop the render. */
  function setPartition(next: { visibleCount: number; hiddenCount: number }): void {
    if (
      next.visibleCount === partition.visibleCount &&
      next.hiddenCount === partition.hiddenCount
    ) {
      return;
    }
    const disclosureVanishes = partition.hiddenCount > 0 && next.hiddenCount === 0;
    partition = next;
    if (!disclosureVanishes) return;
    // The chips now fit: drop the disclosure state (an invisible popover
    // must not keep Escape ownership or reopen on a later resize) and move
    // focus off the vanishing trigger / popover / page body to a surviving
    // row control after the re-render — regardless of whether the popover
    // itself was open (a CLOSED popover whose focused trigger vanishes
    // strands focus exactly the same way).
    const active = document.activeElement;
    const focusAtRisk =
      (popoverEl?.contains(active) ?? false) ||
      active === triggerEl ||
      (active === document.body && disclosureHadFocus);
    overflowOpen = false;
    if (focusAtRisk) {
      void tick().then(() => {
        // Recheck before claiming focus: the user may have moved somewhere
        // deliberate inside the tick, and focus already on a real element
        // must not be yanked to the row.
        if (document.activeElement !== document.body) return;
        const rowRemovals = rowEl?.querySelectorAll<HTMLButtonElement>(
          "li.chip:not(.more-trigger) [data-chip-remove]",
        );
        rowRemovals?.[rowRemovals.length - 1]?.focus();
        disclosureHadFocus = false;
      });
    }
  }

  // The rendered chip set is the measurement's trigger: every apply, change,
  // or removal reshuffles widths and re-partitions the row. DOM reads (and
  // the row binding they go through) stay untracked — the chip set is the
  // only dependency, so re-renders from the measurement cannot re-enter it.
  let settledSignature: string | null = null;
  $effect(() => {
    const signature = chips.map((entry) => entry.key).join("|");
    void singleRow;
    untrack(() => {
      measure();
      // The partition's own render (the trigger appearing, moving, or
      // changing its count) alters the measured trigger width; re-measure
      // once per chip-set change so the reserve matches reality. Identical
      // measurements never write, and the once-per-signature guard keeps
      // the settle from ping-ponging on sub-pixel boundaries.
      if (partition.hiddenCount > 0 && settledSignature !== signature) {
        settledSignature = signature;
        void tick().then(() => untrack(() => measure()));
      }
    });
  });

  $effect(() => {
    if (!singleRow || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    if (rowEl) observer.observe(rowEl);
    // A late font swap changes chip widths without resizing the row.
    document.fonts?.ready.then(() => measure()).catch(() => {});
    return () => observer.disconnect();
  });

  // --- Overflow popover -----------------------------------------------------

  function toggleOverflow(): void {
    if (overflowOpen) {
      closeOverflow(true);
      return;
    }
    overflowOpen = true;
    updatePopoverCap();
    // Focus moves in on open, onto the first removal so keyboard users can
    // work through the chips immediately (Tab from the non-interactive
    // container would leave the disclosure in some engines).
    void tick().then(() => {
      const firstRemoval = popoverEl?.querySelector<HTMLButtonElement>("[data-chip-remove]");
      (firstRemoval ?? popoverEl)?.focus();
    });
  }

  /** Escape and the close action return focus to the trigger; light dismiss does not. */
  function closeOverflow(refocusTrigger: boolean): void {
    overflowOpen = false;
    if (refocusTrigger) triggerEl?.focus();
  }

  /** Caps the popover by the space below the row (usable minimum 6rem). */
  function updatePopoverCap(): void {
    const row = rowEl;
    if (!row || typeof window === "undefined") return;
    const space = window.innerHeight - row.getBoundingClientRect().bottom - 16;
    popoverMaxHeightPx = Math.max(96, Math.min(256, Math.round(space)));
  }

  function onAnchorFocusin(): void {
    disclosureHadFocus = true;
  }

  /** Light dismiss: focus moving to a target outside closes it, no yanking. */
  function onAnchorFocusout(event: FocusEvent): void {
    const next = event.relatedTarget;
    // A targetless (or already-detached) relatedTarget means the focused
    // control just left the DOM — keep the flag so the fit-repair can still
    // rescue the strand; only a real move somewhere outside clears it.
    if (next instanceof Node && next.isConnected && !anchorEl?.contains(next)) {
      disclosureHadFocus = false;
    }
    if (!next && event.target instanceof Node && event.target.isConnected) {
      // A targetless blur whose target is STILL CONNECTED is a deliberate
      // blur (blank-space click, window blur), not a control leaving the
      // DOM — the fit-repair must not treat that strand as its own.
      disclosureHadFocus = false;
    }
    if (!overflowOpen) return;
    if (next instanceof Node && anchorEl?.contains(next)) return;
    if (!next) {
      // Targetless focusout with the popover still mounted: focus blurred
      // through non-focusable popover content — re-anchor it inside after
      // the browser finishes its own focus update (a synchronous focus()
      // here can be overridden). A popover unmounting after a chip removal
      // never fires this — the removal flow retargets.
      void tick().then(() => {
        if (overflowOpen) popoverEl?.focus();
      });
      return;
    }
    overflowOpen = false;
  }

  $effect(() => {
    if (!overflowOpen) return;
    const onOutsidePointerDown = (event: Event) => {
      if (event.target instanceof Node && anchorEl?.contains(event.target)) return;
      overflowOpen = false;
    };
    // Light-dismiss layers answer Escape while open, in the CAPTURE phase so
    // an open popover consumes the key before any other open layer (the
    // unit detail slide-over listens on the window too): only the popover
    // closes, and other listeners never see the handled key.
    const onKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeOverflow(true);
      }
    };
    const onResize = () => updatePopoverCap();
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onOutsidePointerDown, true);
    window.addEventListener("keydown", onKeydown, true);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onOutsidePointerDown, true);
      window.removeEventListener("keydown", onKeydown, true);
    };
  });

  /**
   * Runs `step` once per scheduler turn until it succeeds or the attempts
   * run out — removal retargeting must not assume how many flushes the
   * store's async apply, the re-render, and the re-measurement take.
   */
  async function waitFor(step: () => boolean, attempts = 20): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (step()) return true;
      await tick();
    }
    return step();
  }

  /**
   * Removal from inside the popover keeps focus on a logical neighbor: the
   * removal control that took the removed chip's place, the row's last
   * removal when the overflow disappeared, or the band's fallback target
   * when the selection emptied — never the page body.
   */
  async function removeChipFromPopover(index: number): Promise<void> {
    const chip = chips[index];
    if (!chip) return;
    // Pre-removal successor: it occupies the removed chip's position after
    // the removal (the previous chip when the last one goes).
    const successor = chips[index + 1] ?? chips[index - 1];
    const successorKey = successor ? successor.key : "";

    // Focus the neighbor synchronously (it lives in this popover). With no
    // successor the popover container unmounts at the next flush (selection
    // emptied), so the owner's persistent fallback takes the focus instead.
    if (!focusChipRemoval(successorKey)) onFallbackFocus?.();

    await store.apply({ kind: "remove-value", filterId: chip.filterId, value: chip.value });

    if (Object.keys(store.selection).length === 0) {
      overflowOpen = false;
      if (document.activeElement === document.body) onEmptied?.();
      return;
    }

    // Retarget only when the focused control left the DOM (focus fell to the
    // page body) — never yank focus the user moved somewhere deliberate.
    const displaced = await waitFor(() => document.activeElement === document.body);
    if (!displaced) return;

    const neighbor = chips[Math.min(index, chips.length - 1)];
    const neighborKey = neighbor ? neighbor.key : "";
    const disclosureStillThere = await waitFor(() => {
      if (rowEl?.querySelector("li.more-trigger") == null) return false;
      const refocused = focusChipRemoval(neighborKey) || focusAnyPopoverRemoval();
      return refocused && rowEl?.querySelector("li.more-trigger") != null;
    });
    if (disclosureStillThere) return;

    // The overflow disappeared with that removal: the trigger and popover
    // are gone; land on the row's last removal — and close the disclosure
    // state so a later re-overflow never reopens it uninvited.
    overflowOpen = false;
    await waitFor(() => {
      if (rowEl?.querySelector("li.more-trigger")) return false;
      const rowRemovals = rowEl?.querySelectorAll<HTMLButtonElement>(
        "li.chip:not(.more-trigger) [data-chip-remove]",
      );
      rowRemovals?.[rowRemovals.length - 1]?.focus();
      return document.activeElement === rowRemovals?.[rowRemovals.length - 1];
    });
  }

  function focusChipRemoval(key: string): boolean {
    if (key === "") return false;
    const target = popoverEl?.querySelector<HTMLButtonElement>(
      `[data-chip-key=${CSS.escape(key)}]`,
    );
    if (!target || !target.isConnected) return false;
    target.focus();
    return document.activeElement === target;
  }

  function focusAnyPopoverRemoval(): boolean {
    const target = popoverEl?.querySelector<HTMLButtonElement>("[data-chip-remove]");
    if (!target) return false;
    target.focus();
    return document.activeElement === target;
  }

  /** Focuses a removal control by chip key and reports whether it took focus. */
  function focusRemoval(scope: HTMLElement | undefined, key: string): boolean {
    if (key === "") return false;
    const target = scope?.querySelector<HTMLButtonElement>(`[data-chip-key=${CSS.escape(key)}]`);
    if (!target || target.closest("li.cut")) return false;
    target.focus();
    return document.activeElement === target;
  }

  /**
   * Focuses the removal control of the chip at `index` when that chip is
   * visible and focusable in the current surface (clipped chips are inert).
   * Reports whether it took focus.
   */
  function focusVisibleRemoval(index: number): boolean {
    const chip = chips[index];
    if (!chip) return false;
    const scope = singleRow ? rowEl : listEl;
    return focusRemoval(scope, chip.key);
  }

  /**
   * Removing a visible chip (bounded band row or the freely wrapping list)
   * keeps keyboard focus on the chip that took the removed one's position —
   * and hands off to the band's fallback when the selection emptied. Never
   * the page body.
   */
  async function removeChipAt(index: number): Promise<void> {
    const chip = chips[index];
    if (!chip) return;
    const bounded = singleRow;
    // Capture the surface before the removal flush: if results recovery
    // unmounts it, the binding clears to null and the detachment is the
    // only remaining signal for the fallback handoff.
    const scope = bounded ? rowEl : listEl;

    // Hold focus synchronously: both controls exist right now, so focus
    // never sits on the page body while the store refresh runs. The
    // successor takes it; when there is none, the previous chip does — the
    // disclosure trigger is NOT a stable target here (the post-removal
    // flush can destroy and re-create it), so it is only re-focused after
    // the refresh, when it has actually survived.
    const held = focusVisibleRemoval(index + 1) || (index > 0 && focusVisibleRemoval(index - 1));
    if (!held) onFallbackFocus?.();

    await store.apply({ kind: "remove-value", filterId: chip.filterId, value: chip.value });

    if (Object.keys(store.selection).length === 0) {
      if (document.activeElement === document.body) onEmptied?.();
      return;
    }

    // Retarget only when the focused control left the DOM (focus fell to the
    // page body) — never yank focus the user moved somewhere deliberate.
    const displaced = await waitFor(() => document.activeElement === document.body);
    if (!displaced) return;

    const neighbor = chips[Math.min(index, chips.length - 1)];
    const neighborKey = neighbor ? neighbor.key : "";

    await waitFor(() => {
      // The surface left the DOM (zero-panel results recovered): its owner
      // owns the fallback landing spot — only while focus sits on the body.
      if (scope && !scope.isConnected) {
        if (document.activeElement === document.body) onEmptied?.();
        return true;
      }
      if (focusRemoval(scope, neighborKey)) return true;
      // The neighbor sits beyond the bounded row's clip: the disclosure
      // trigger is the logical standing point — and the disclosure state
      // closes so a later re-overflow never reopens it uninvited.
      if (bounded) {
        overflowOpen = false;
        triggerEl?.focus();
        if (document.activeElement === triggerEl) return true;
      }
      return false;
    });
  }

  async function clearAllChips(): Promise<void> {
    // Focus a persistent target synchronously (the zero-panel owner's
    // standing point) so the unmounting button never drops focus to the
    // page body during the store refresh.
    onFallbackFocus?.();
    await store.clearAll();
    // Results recovered and focus is unclaimed: hand off to the count line.
    if (document.activeElement === document.body) onEmptied?.();
  }
</script>

{#snippet chip(
  definition: FilterDefinition,
  key: string,
  value: string,
  cut: boolean,
  onremove: () => void,
)}
  <li class="chip" class:cut inert={cut || undefined}>
    {chipLabel(definition, value)}
    <button
      type="button"
      data-chip-remove
      data-chip-key={key}
      aria-label={m.chip_remove({
        filter: definition.label,
        value: valueLabel(definition, value),
      })}
      onclick={onremove}
    >
      <span aria-hidden="true">×</span>
    </button>
  </li>
{/snippet}

{#snippet moreTrigger()}
  <li class="chip more-trigger">
    <button
      type="button"
      bind:this={triggerEl}
      aria-expanded={overflowOpen}
      aria-controls="chips-overflow"
      onclick={toggleOverflow}
    >
      {m.chip_more_count({ count: partition.hiddenCount })}
    </button>
  </li>
{/snippet}

{#if hasAnySelection}
  {#if singleRow}
    <div
      class="chips-anchor"
      bind:this={anchorEl}
      onfocusin={onAnchorFocusin}
      onfocusout={onAnchorFocusout}
    >
      <div class="chips-row" bind:this={rowEl}>
        <ul class="chips single-row" aria-label={m.chips_region_label()}>
          <!-- Nothing fits beside the disclosure: the trigger leads the row
               so it stays inside the clip and reachable. -->
          {#if partition.hiddenCount > 0 && partition.visibleCount === 0}
            {@render moreTrigger()}
          {/if}
          {#each chips as applied, index (applied.key)}
            {@render chip(
              applied.definition,
              applied.key,
              applied.value,
              index >= partition.visibleCount,
              () => removeChipAt(index),
            )}
            {#if partition.hiddenCount > 0 && index === partition.visibleCount - 1}
              {@render moreTrigger()}
            {/if}
          {/each}
        </ul>
      </div>
      {#if overflowOpen && partition.hiddenCount > 0}
        <div
          class="chips-popover"
          id="chips-overflow"
          role="group"
          aria-label={m.chips_overflow_label()}
          tabindex="-1"
          bind:this={popoverEl}
          style:max-height={`${popoverMaxHeightPx}px`}
        >
          <div class="popover-head">
            <span class="popover-title">{m.chips_overflow_label()}</span>
            <button type="button" onclick={() => closeOverflow(true)}>
              {m.chips_overflow_close()}
            </button>
          </div>
          <ul class="chips popover-chips" aria-label={m.chips_region_label()}>
            {#each chips as applied, index (applied.key)}
              {@render chip(applied.definition, applied.key, applied.value, false, () =>
                removeChipFromPopover(index),
              )}
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {:else}
    <ul class="chips" bind:this={listEl} aria-label={m.chips_region_label()}>
      {#each chips as applied, index (applied.key)}
        {@render chip(applied.definition, applied.key, applied.value, false, () =>
          removeChipAt(index),
        )}
      {/each}
    </ul>
  {/if}
  {#if clearAll}
    <button type="button" class="clear-all-chips" onclick={clearAllChips}>
      {m.chip_clear_all()}
    </button>
  {/if}
{/if}

<style>
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  /* Bounded one-row presentation: never wraps, chips keep their full width
     and clip at the row edge instead of squeezing. Chips that do not fit
     stay in the DOM (their widths stay measurable) but are hidden and
     inert — the popover is where they remain reachable. */
  .chips.single-row {
    flex-wrap: nowrap;
  }
  .single-row .chip {
    flex-shrink: 0;
  }
  .single-row .chip.cut {
    visibility: hidden;
  }
  .chips-anchor {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }
  .chips-row {
    /* Fallback first: engines without `clip` keep the plain hidden clip.
       Vertical clipping is off entirely so the shared focus ring (3px at a
       2px offset) paints around focused chips and the disclosure trigger. */
    overflow: hidden;
    overflow-x: clip;
    overflow-y: visible;
  }
  .more-trigger {
    padding: 0;
  }
  .more-trigger button {
    font: inherit;
    font-size: var(--font-size-small);
    border: 1px solid var(--color-line-strong);
    background: var(--color-surface-raised);
    color: var(--color-ink);
    border-radius: var(--rounded-pill);
    padding: 0.15rem 0.65rem;
  }
  /* Non-modal overflow popover: absolutely positioned under the row so
     opening it can never displace the layout or the map pane. It renders
     outside the clipping row (inside the anchor) so it is never cut, and
     sits above the open unit detail slide-over — the popover is the most
     recently opened layer (Escape layering is handled by its capture
     handler). */
  .chips-popover {
    position: absolute;
    top: calc(100% + var(--spacing-sm));
    right: 0;
    z-index: 35;
    width: min(20rem, 100%);
    /* The inline style caps this by the space below the row (updatePopoverCap);
       this declaration is the pre-measurement fallback. */
    max-height: 16rem;
    overflow-y: auto;
    display: grid;
    gap: 0.375rem;
    padding: var(--spacing-sm);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    box-shadow: var(--shadow);
  }
  .popover-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }
  .popover-title {
    font-weight: 600;
    font-size: var(--font-size-small);
    color: var(--color-ink);
  }
  .popover-head button {
    font: inherit;
    font-size: var(--font-size-small);
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--color-surface-selected);
    border: 1px solid var(--color-line);
    border-radius: var(--rounded-pill);
    padding: 0.15rem 0.35rem 0.15rem 0.65rem;
    font-size: var(--font-size-small);
  }
  .chip button {
    font: inherit;
    font-size: 0.75rem;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    padding: 0.1rem 0.35rem;
    border-radius: var(--rounded-pill);
  }
  .clear-all-chips {
    align-self: start;
    font: inherit;
    font-size: var(--font-size-small);
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--rounded-control);
    background: var(--color-surface-raised);
    color: var(--color-ink);
  }
</style>
