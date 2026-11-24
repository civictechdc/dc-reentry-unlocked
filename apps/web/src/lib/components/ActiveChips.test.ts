import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS, type FilterDefinition } from "@dc-reentry/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { tick } from "svelte";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { m } from "#lib/paraglide/messages.js";
import ActiveChips from "./ActiveChips.svelte";
import FilterBar from "./FilterBar.svelte";

// jsdom has no layout engine (every rect and clientWidth reads zero), so the
// overflow tests substitute the measurement at the pure-partition boundary:
// the mock receives the real measured widths and returns the partition the
// component renders from. The actual overflow math is covered in
// chips-overflow.test.ts, and real-browser behavior by the e2e suite.
const overflowMocks = vi.hoisted(() => ({
  partition: undefined as
    | ((widths: number[], gap: number, rowWidth: number, reserve: number) => unknown)
    | undefined,
}));

vi.mock("./chips-overflow.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chips-overflow.ts")>();
  return {
    chipsOverflow: (...args: Parameters<typeof actual.chipsOverflow>) =>
      overflowMocks.partition
        ? (overflowMocks.partition(...args) as ReturnType<typeof actual.chipsOverflow>)
        : actual.chipsOverflow(...args),
  };
});

class FakeTransport {
  cards: never[] = [];
  async filters() {
    return UNIT_FILTERS;
  }
  async units() {
    return this.cards;
  }
}

let store: HousingStore;

beforeEach(async () => {
  store = new HousingStore(new FakeTransport() as never);
  await store.initialize();
});

afterEach(() => cleanup());

const trigger = () => screen.getByRole("button", { name: /\+\d+ more/ });
const popover = () => screen.getByRole("group", { name: m.chips_overflow_label() });

describe("active selection chips", () => {
  test("each active selection renders as an individually removable chip", async () => {
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    await store.apply({
      kind: "apply",
      filterId: "referral-required",
      control: "boolean",
      values: ["yes"],
    });
    render(ActiveChips, { props: { store } });

    expect(screen.getByText("Ward: Ward 1")).toBeInTheDocument();
    expect(screen.getByText("Referral required: Yes")).toBeInTheDocument();

    const removeWard = screen.getByRole("button", {
      name: m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    });
    await userEvent.click(removeWard);

    expect(store.selection.ward).toBeUndefined();
    expect(store.selection["referral-required"]).toEqual(["yes"]);
  });

  test("clear-all removes every chip in one go", async () => {
    await store.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5"],
    });
    await store.apply({
      kind: "apply",
      filterId: "gender",
      control: "single-select",
      values: ["men"],
    });
    render(ActiveChips, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: m.chip_clear_all() }));
    expect(store.selection).toEqual({});
  });

  test("chips disappear with their selection (a filter removed from the schema)", async () => {
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    await store.reloadSchema();
    store.filtersSchema = [];
    render(ActiveChips, { props: { store } });
    expect(screen.queryByText("Ward: Ward 1")).not.toBeInTheDocument();
  });

  test("with clearAll off the chips render without their own clear-all (a reserved band owns it)", async () => {
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    render(ActiveChips, { props: { store, clearAll: false } });

    expect(screen.getByText("Ward: Ward 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: m.chip_clear_all() })).not.toBeInTheDocument();
  });
});

describe("popover escape layering", () => {
  beforeEach(() => {
    overflowMocks.partition = (widths: number[]) =>
      widths.length > 1
        ? { visibleCount: widths.length - 1, hiddenCount: 1 }
        : { visibleCount: widths.length, hiddenCount: 0 };
  });

  test("a closed popover whose focused trigger vanishes moves focus to a row removal", async () => {
    // The popover stays CLOSED through this test: focus sits on the trigger
    // alone. When a re-measure makes every chip fit, the trigger vanishes —
    // and focus must not be stranded on the page body.
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 1 });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await trigger().focus();
    expect(document.activeElement).toBe(trigger());

    overflowMocks.partition = () => ({ visibleCount: 2, hiddenCount: 0 });
    await store.apply({
      kind: "apply",
      filterId: "gender",
      control: "single-select",
      values: ["men"],
    });
    await tick();
    await tick();

    // The trigger is gone (its aria-expanded state went with it) and a
    // surviving row removal holds focus.
    expect(screen.queryByRole("button", { name: /\+\d+ more/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    const rowRemovalFocused = [
      ...(document.querySelectorAll(".chips-row li.chip:not(.more-trigger) [data-chip-remove]") ??
        []),
    ].some((button) => document.activeElement === button);
    expect(rowRemovalFocused, "focus moved to a surviving row removal").toBe(true);
  });

  test("escape inside the popover consumes the key before other window listeners", async () => {
    const otherListener = vi.fn();
    window.addEventListener("keydown", otherListener);
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);

    await userEvent.click(trigger());
    await tick();
    await userEvent.keyboard("{Escape}");
    await tick();

    // Only the popover closed, and the bubble-phase listener never saw the
    // handled key (another open layer must not close with it).
    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    expect(otherListener).not.toHaveBeenCalled();
    window.removeEventListener("keydown", otherListener);
  });

  test("at zero visible chips the disclosure trigger leads the row (first child)", async () => {
    // The nothing-fits state: a trigger inserted after a full-width chip
    // would start past the clip edge and be unreachable.
    overflowMocks.partition = () => ({ visibleCount: 0, hiddenCount: 2 });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);

    const first = document.querySelector(".chips-row ul > *");
    expect(first?.classList.contains("more-trigger")).toBe(true);
    await userEvent.click(trigger());
    await tick();
    expect(popover()).toBeInTheDocument();
  });

  test("when a re-measure makes every chip fit the popover closes and focus moves to a row removal", async () => {
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 1 });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();
    expect(popover()).toBeInTheDocument();

    // The re-measured partition says everything fits: the invisible popover
    // closes and its focus lands on a surviving row removal.
    overflowMocks.partition = () => ({ visibleCount: 2, hiddenCount: 0 });
    await store.apply({
      kind: "apply",
      filterId: "gender",
      control: "single-select",
      values: ["men"],
    });
    await tick();
    await tick();

    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+\d+ more/ })).not.toBeInTheDocument();
    // Focus lands on a surviving row removal (the trigger is gone), and the
    // disclosure state is closed: a later re-overflow cannot reopen the
    // popover uninvited.
    expect(document.activeElement).not.toBe(document.body);
    const rowRemovalFocused = [
      ...(document.querySelectorAll(".chips-row li.chip:not(.more-trigger) [data-chip-remove]") ??
        []),
    ].some((button) => document.activeElement === button);
    expect(rowRemovalFocused).toBe(true);
  });

  test("a fit-repair never claims focus a user deliberately left on the page body", async () => {
    // Deliberate body focus (clicking blank space): no disclosure control
    // ever held focus, so the re-measure that makes every chip fit must
    // leave the user's focus exactly where they put it.
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 1 });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    expect(document.activeElement).toBe(document.body);

    overflowMocks.partition = () => ({ visibleCount: 2, hiddenCount: 0 });
    await store.apply({
      kind: "apply",
      filterId: "gender",
      control: "single-select",
      values: ["men"],
    });
    await tick();
    await tick();

    // The disclosure vanished while focus was deliberately on the body:
    // nothing is yanked to the row.
    expect(document.activeElement).toBe(document.body);
  });

  test("a deliberate blur out of the disclosure clears its fit-repair focus claim", async () => {
    // The trigger held focus; the user then blurred it deliberately (the
    // control stays in the DOM — a targetless focusout from a connected
    // target). A later fit-repair must not treat that strand as its own.
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 1 });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await trigger().focus();

    // Deliberate blur: focus moves to the body, and the blur reports as a
    // targetless focusout whose target is still connected (dispatched here
    // so the test does not lean on the environment's native focus events).
    trigger().blur();
    expect(document.activeElement).toBe(document.body);
    trigger().dispatchEvent(new FocusEvent("focusout", { relatedTarget: null, bubbles: true }));

    overflowMocks.partition = () => ({ visibleCount: 2, hiddenCount: 0 });
    await store.apply({
      kind: "apply",
      filterId: "gender",
      control: "single-select",
      values: ["men"],
    });
    await tick();
    await tick();

    // Focus stays where the user left it — nothing is claimed for the row.
    expect(document.activeElement).toBe(document.body);
  });

  test("a vanishing disclosure whose own controls held focus still rescues focus to a row removal", async () => {
    // The trigger held focus; the clicked removal's chip then left the DOM
    // (no fallback target in this harness) and focus fell to the body — the
    // fit-repair rescues the strand onto the surviving row removal.
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 1 });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await trigger().focus();

    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 0 });
    await userEvent.click(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) }),
    );
    await tick();
    await tick();

    // Ward 5 is the only chip left and its removal holds focus.
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 5" }),
    );
  });

  test("an Escape another layer already handled does not close the popover", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    const handled = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    window.dispatchEvent(handled);
    await tick();

    expect(popover()).toBeInTheDocument();
  });
});

function gatedStoreSetup(): {
  store: HousingStore;
  releaseUnits: () => void;
} {
  let releaseUnits: (() => void) | undefined;
  const transport = {
    filters: async () => UNIT_FILTERS,
    units: () =>
      new Promise<never[]>((resolve) => {
        releaseUnits = () => resolve([]);
      }),
  };
  const gated = new HousingStore(transport as never);
  void gated.initialize();
  return { store: gated, releaseUnits: () => releaseUnits?.() ?? undefined };
}

describe("lone-chip removal fallback", () => {
  beforeEach(() => {
    overflowMocks.partition = (widths: number[]) =>
      widths.length > 1
        ? { visibleCount: widths.length - 1, hiddenCount: 1 }
        : { visibleCount: widths.length, hiddenCount: 0 };
  });

  test("a wrapping-list lone-chip removal defers to the fallback synchronously with a gated refresh", async () => {
    // Gated transport: the removal's refresh stays pending for the whole
    // assertion — the owner's fallback must take focus synchronously,
    // before any await.
    let releaseUnits: (() => void) | undefined;
    const transport = {
      filters: async () => UNIT_FILTERS,
      units: () =>
        new Promise<never[]>((resolve) => {
          releaseUnits = () => resolve([]);
        }),
    };
    const gatedStore = new HousingStore(transport as never);
    void gatedStore.initialize();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1"],
    });

    const fallbackTarget = document.createElement("button");
    fallbackTarget.dataset.testid = "owner-fallback";
    document.body.appendChild(fallbackTarget);
    const onFallbackFocus = vi.fn(() => fallbackTarget.focus());
    render(ActiveChips, {
      props: { store: gatedStore, clearAll: false, onFallbackFocus },
    });
    await tick();

    // Native, un-awaited click: the handler suspends in the pending apply.
    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) })
      .click();

    expect(onFallbackFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(fallbackTarget);

    if (releaseUnits) releaseUnits();
    await tick();
    fallbackTarget.remove();
  });

  test("a bounded-row lone-chip removal defers to the band's fallback synchronously with a never-resolving apply", async () => {
    let releaseUnits: (() => void) | undefined;
    const transport = {
      filters: async () => UNIT_FILTERS,
      units: () =>
        new Promise<never[]>((resolve) => {
          releaseUnits = () => resolve([]);
        }),
    };
    const gatedStore = new HousingStore(transport as never);
    void gatedStore.initialize();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1"],
    });
    render(FilterBar, { props: { store: gatedStore, summaryBand: true } });
    await tick();

    // The lone chip: no successor, no previous chip — the band's fallback
    // (the summary heading) holds focus from the click onward. The heading
    // element persists across the count change (1 → 0).
    const heading = screen.getByRole("heading", { name: "Selected filters (1)" });
    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) })
      .click();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(heading);
    if (releaseUnits) releaseUnits();
  });
});

describe("removal focus continuity", () => {
  beforeEach(() => {
    overflowMocks.partition = (widths: number[]) =>
      widths.length > 1
        ? { visibleCount: widths.length - 1, hiddenCount: 1 }
        : { visibleCount: widths.length, hiddenCount: 0 };
  });

  test("a removal focuses the successor synchronously, before the store's apply resolves", async () => {
    // Gated transport: the store's refresh stays pending for the whole
    // assertion — the successor must hold focus immediately after the click,
    // with no await in between.
    const { store: gatedStore, releaseUnits } = gatedStoreSetup();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5"],
    });
    render(ActiveChips, { props: { store: gatedStore, clearAll: false } });

    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) })
      .click();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 5" }),
    );
    releaseUnits();
  });

  test("focus the user moved during a pending removal is not yanked afterwards", async () => {
    const { store: gatedStore, releaseUnits } = gatedStoreSetup();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5"],
    });
    render(ActiveChips, { props: { store: gatedStore, clearAll: false } });

    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) })
      .click();
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    releaseUnits();
    await tick();
    await tick();
    await tick();

    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  test("a bounded-row removal with a clipped successor parks focus on the previous visible chip synchronously", async () => {
    const { store: gatedStore, releaseUnits } = gatedStoreSetup();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5", "3"],
    });
    overflowMocks.partition = () => ({ visibleCount: 2, hiddenCount: 1 });
    render(ActiveChips, { props: { store: gatedStore, clearAll: false, singleRow: true } });
    await tick();

    // Removing the LAST VISIBLE chip: its successor is clipped, so the
    // PREVIOUS visible chip holds focus from the click onward (the trigger
    // is not a stable target during a removal).
    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 5" }) })
      .click();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    );

    // While the refresh is held: focus stays on that removal — never the
    // page body.
    await tick();
    await tick();
    expect(document.activeElement).not.toBe(document.body);

    // After release: focus is not yanked.
    releaseUnits();
    await tick();
    await tick();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    );
  });

  test("removing the lone chip from the popover defers to the owner's fallback immediately", async () => {
    // Gated transport: the removal's refresh stays pending for the whole
    // assertion — the owner's fallback target must hold focus immediately
    // after an un-awaited click (the popover container itself unmounts once
    // the emptied selection flushes).
    let releaseUnits: (() => void) | undefined;
    const transport = {
      filters: async () => UNIT_FILTERS,
      units: () =>
        new Promise<never[]>((resolve) => {
          releaseUnits = () => resolve([]);
        }),
    };
    const gatedStore = new HousingStore(transport as never);
    void gatedStore.initialize();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1"],
    });

    const fallbackTarget = document.createElement("button");
    fallbackTarget.dataset.testid = "owner-fallback";
    document.body.appendChild(fallbackTarget);
    const onFallbackFocus = vi.fn(() => fallbackTarget.focus());

    overflowMocks.partition = () => ({ visibleCount: 0, hiddenCount: 1 });
    render(ActiveChips, {
      props: { store: gatedStore, clearAll: false, singleRow: true, onFallbackFocus },
    });
    await tick();

    await userEvent.click(trigger());
    await tick();

    // Un-awaited native click: the handler suspends in the pending apply —
    // the fallback target already holds focus.
    popover().querySelectorAll<HTMLButtonElement>("[data-chip-remove]")[0]?.click();

    expect(onFallbackFocus).toHaveBeenCalled();
    expect(document.activeElement).toBe(fallbackTarget);

    if (releaseUnits) releaseUnits();
    await tick();
    await tick();
    // Selection emptied and flushed: the strip and popover are gone.
    expect(screen.queryByRole("button", { name: /\+\d+ more/ })).not.toBeInTheDocument();
    fallbackTarget.remove();
  });

  test("removing a hostile-valued chip lands focus on the neighbor chip", async () => {
    const hostileValue = 'a:b"c\\';
    await store.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: [hostileValue, "plain"],
    });
    render(ActiveChips, { props: { store, clearAll: false } });

    await userEvent.click(
      screen.getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: hostileValue }),
      }),
    );
    await tick();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "plain" }),
    );
    expect(store.selection.ward).toEqual(["plain"]);
  });

  test("keys for values that collide when naively joined stay distinct chips", async () => {
    const collidingSchema: FilterDefinition[] = [
      {
        id: "a",
        label: "Alpha",
        control: "multi-select",
        target: "unit.ward",
        options: [
          { value: "b:c", label: "B colon c" },
          { value: "plain", label: "Plain" },
        ],
      },
      {
        id: "a:b",
        label: "Alpha colon",
        control: "multi-select",
        target: "unit.ward",
        options: [{ value: "c", label: "C" }],
      },
    ];
    const collidingTransport = {
      filters: async () => collidingSchema,
      units: async () => [],
    };
    const collidingStore = new HousingStore(collidingTransport as never);
    await collidingStore.initialize();
    await collidingStore.apply({
      kind: "apply",
      filterId: "a",
      control: "multi-select",
      values: ["b:c"],
    });
    await collidingStore.apply({
      kind: "apply",
      filterId: "a:b",
      control: "multi-select",
      values: ["c"],
    });
    render(ActiveChips, { props: { store: collidingStore, clearAll: false } });

    // Two DISTINCT chips (a naive "a" + ":" + "b:c" join would collide).
    expect(screen.getByText("Alpha: B colon c")).toBeInTheDocument();
    expect(screen.getByText("Alpha colon: C")).toBeInTheDocument();

    // Removing one removes exactly that value.
    await userEvent.click(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Alpha colon", value: "C" }) }),
    );
    await tick();
    await tick();

    expect(screen.getByText("Alpha: B colon c")).toBeInTheDocument();
    expect(screen.queryByText("Alpha colon: C")).not.toBeInTheDocument();
    expect(collidingStore.selection["a"]).toEqual(["b:c"]);
    expect(collidingStore.selection["a:b"]).toBeUndefined();
  });

  test("removing a wrapping-list chip moves keyboard focus to the chip that took its place", async () => {
    await store.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5", "3"],
    });
    render(ActiveChips, { props: { store, clearAll: false } });

    await userEvent.click(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) }),
    );
    await tick();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 5" }),
    );
  });

  test("when the wrapping list itself unmounts after a removal the fallback fires (results recovered)", async () => {
    const onEmptied = vi.fn();
    await store.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1", "5", "3"],
    });
    render(ActiveChips, { props: { store, clearAll: false, onEmptied } });

    // The zero-panel scenario: the removal recovers results and the list's
    // owner unmounts it mid-removal — focus must defer to the fallback.
    // A synchronous native click suspends the handler inside the store's
    // async apply, so the detach lands while it is still in flight.
    const removeBtn = screen.getByRole("button", {
      name: m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    });
    removeBtn.click();
    screen.getByRole("list").remove();
    await vi.waitFor(() => expect(onEmptied).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  test("when the last wrapping chip empties the selection the fallback callback fires", async () => {
    const onEmptied = vi.fn();
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    render(ActiveChips, { props: { store, clearAll: false, onEmptied } });

    await userEvent.click(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) }),
    );
    await tick();

    expect(onEmptied).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ward: Ward 1")).not.toBeInTheDocument();
  });

  test("the wrapping list's own clear-all hands focus to the fallback when the selection empties", async () => {
    const onEmptied = vi.fn();
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    render(ActiveChips, { props: { store, onEmptied } });

    await userEvent.click(screen.getByRole("button", { name: m.chip_clear_all() }));
    await tick();

    expect(store.selection).toEqual({});
    expect(onEmptied).toHaveBeenCalledTimes(1);
  });

  test("removing a bounded-row chip whose neighbor stays visible focuses that neighbor", async () => {
    // Both chips fully visible: the plain in-row neighbor path.
    overflowMocks.partition = (widths: number[]) => ({
      visibleCount: widths.length,
      hiddenCount: 0,
    });
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);

    await userEvent.click(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 1" }) }),
    );
    await tick();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 5" }),
    );
  });

  test("chip keys stay collision-free and selector-safe for hostile ids and values", async () => {
    // Hostile-shaped ids/values flow through the schema envelope in theory;
    // the key encoding must keep distinct chips distinct and the selector
    // must match them whatever characters they carry.
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 1 });
    // Values are rendered verbatim for unknown option values, so a
    // quote/colon/backslash payload must produce distinct retrievable keys
    // and selector-safe lookups (defense in depth for schema-published text).
    const hostileValue = 'a:b"c\\';
    await store.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: [hostileValue, "plain"],
    });
    render(ActiveChips, { props: { store, clearAll: false, singleRow: true } });
    await tick();

    expect(
      screen.getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: hostileValue }),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "plain" }) }),
    ).toBeInTheDocument();
  });

  test("a bounded-row removal whose neighbor is clipped lands focus on the previous visible chip's removal, never an inert control", async () => {
    // Three chips, one hidden: removing the LAST VISIBLE chip puts its
    // successor (a clipped chip) at the neighbor position — focus lands on
    // the previous visible chip's removal instead of an inert control.
    await renderWithSelections([{ filterId: "ward", values: ["1", "5", "3"] }]);

    await userEvent.click(
      screen.getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 5" }) }),
    );
    await tick();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    );
  });
});

async function renderWithSelections(
  selections: { filterId: string; values: string[] }[],
  props: Record<string, unknown> = {},
): Promise<void> {
  for (const selection of selections) {
    await store.apply({
      kind: "apply",
      filterId: selection.filterId,
      control: "multi-select",
      values: selection.values,
    });
  }
  render(ActiveChips, { props: { store, clearAll: false, singleRow: true, ...props } });
  await tick();
}

describe("bounded row overflow disclosure", () => {
  beforeEach(() => {
    // One chip hides whenever more than one is applied; everything fits at one.
    overflowMocks.partition = (widths: number[]) =>
      widths.length > 1
        ? { visibleCount: widths.length - 1, hiddenCount: 1 }
        : { visibleCount: widths.length, hiddenCount: 0 };
  });

  test("the overflow trigger opens a popover that lists every applied chip and takes focus", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);

    expect(trigger()).toBeInTheDocument();
    await userEvent.click(trigger());
    await tick();

    expect(popover()).toBeVisible();
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    );
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(popover()).getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: "Ward 1" }),
      }),
    ).toBeInTheDocument();
    expect(
      within(popover()).getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: "Ward 5" }),
      }),
    ).toBeInTheDocument();
  });

  test("escape closes the popover and returns focus to the overflow trigger", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    await userEvent.keyboard("{Escape}");
    await tick();

    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  test("the popover's close control also returns focus to the trigger", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    await userEvent.click(screen.getByRole("button", { name: m.chips_overflow_close() }));
    await tick();

    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
  });

  test("a click outside the popover dismisses it", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    await userEvent.click(document.body);
    await tick();

    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
  });

  test("focus moving outside the disclosure dismisses the popover without yanking focus back", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    popover().dispatchEvent(new FocusEvent("focusout", { relatedTarget: outside, bubbles: true }));
    await tick();

    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  test("a targetless focusout re-anchors focus inside the popover after the browser settles", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    // Clicking non-focusable popover content blurs to the body with no
    // related target: the popover re-anchors focus inside itself and stays
    // open.
    popover()
      .querySelector(".popover-title")
      ?.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null, bubbles: true }));
    await tick();
    await tick();

    expect(popover()).toBeInTheDocument();
    expect(popover().contains(document.activeElement)).toBe(true);
  });

  test("a targetless focusout (the focused removal left the DOM) does not dismiss the popover", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    popover().dispatchEvent(new FocusEvent("focusout", { relatedTarget: null, bubbles: true }));
    await tick();

    expect(popover()).toBeInTheDocument();
  });

  test("removing a chip inside the popover moves focus to the removal that took its place", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5", "3"] }]);
    await userEvent.click(trigger());
    await tick();

    await userEvent.click(
      within(popover()).getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: "Ward 1" }),
      }),
    );
    await tick();

    // Two chips remain, so the popover stays open and Ward 5's removal now
    // holds the removed chip's position.
    expect(popover()).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 5" }),
    );
  });

  test("when the overflow disappears the trigger hides and focus lands on the row's last removal", async () => {
    await renderWithSelections([{ filterId: "ward", values: ["1", "5"] }]);
    await userEvent.click(trigger());
    await tick();

    await userEvent.click(
      within(popover()).getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: "Ward 5" }),
      }),
    );
    await tick();

    // One chip remains and fits, so the disclosure is gone entirely.
    expect(screen.queryByRole("button", { name: /\+\d+ more/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute(
      "aria-label",
      m.chip_remove({ filter: "Ward", value: "Ward 1" }),
    );
  });

  test("when the selection empties from inside the popover the fallback callback fires", async () => {
    overflowMocks.partition = (widths: number[]) => ({
      visibleCount: Math.max(0, widths.length - 1),
      hiddenCount: widths.length > 0 ? 1 : 0,
    });
    const onEmptied = vi.fn();
    await renderWithSelections([{ filterId: "ward", values: ["1"] }], { onEmptied });
    await userEvent.click(trigger());
    await tick();

    await userEvent.click(
      within(popover()).getByRole("button", {
        name: m.chip_remove({ filter: "Ward", value: "Ward 1" }),
      }),
    );
    await tick();

    expect(onEmptied).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /\+\d+ more/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: m.chips_overflow_label() })).not.toBeInTheDocument();
  });
});
