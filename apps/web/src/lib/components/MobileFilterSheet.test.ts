import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { tick } from "svelte";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import { m } from "#lib/paraglide/messages.js";
import MobileFilterSheet from "./MobileFilterSheet.svelte";

// jsdom has no layout engine, so overflow-dependent behavior substitutes the
// measurement at the pure-partition boundary; the strip's open/close,
// activation, and clear-all behavior run for real. The actual overflow math
// is covered in chips-overflow.test.ts and by the mobile e2e suite.
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
  uiState.filterSheetOpen = false;
  uiState.mobileTab = "map";
  overflowMocks.partition = undefined;
});

afterEach(() => {
  cleanup();
  uiState.filterSheetOpen = false;
});

async function applySelection(values: string[]): Promise<void> {
  await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values });
}

describe("strip clear-all focus during a pending refresh", () => {
  test("the strip clear-all holds focus on the strip during a pending clear and does not yank focus the user moved", async () => {
    // Every units request parks in a queue; the boot and the selection's
    // own refresh settle first, so ONLY the clear's refresh stays pending.
    const pending: Array<(units: never[]) => void> = [];
    const transport = {
      filters: async () => UNIT_FILTERS,
      units: async () =>
        new Promise<never[]>((resolve) => {
          pending.push(resolve);
        }),
    };
    const gatedStore = new HousingStore(transport as never);
    void gatedStore.initialize();
    await vi.waitFor(() => expect(gatedStore.filtersSchema.length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(pending.length).toBe(1));
    pending.shift()!([]);
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["1"],
    });
    await vi.waitFor(() => expect(pending.length).toBe(1));
    pending.shift()!([]);

    render(MobileFilterSheet, { props: { store: gatedStore } });

    const clearButton = screen.getByRole("button", { name: "Clear all filters" });
    clearButton.click();
    const strip = document.querySelector(".summary-row") as HTMLElement;
    expect(document.activeElement).toBe(strip);

    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    // The clear issues exactly one units request (a fresh cycle, or a
    // re-drain of the cycle the selection's refresh left closing); it parks
    // below.
    await vi.waitFor(() => expect(pending.length).toBe(1));
    const unitsBeforeClearRefresh = gatedStore.units;
    pending.shift()!([]);
    // The store commits the released result as a NEW units reference, and
    // the strip's post-clear continuation runs in the same resolution chain
    // — no fixed tick count.
    await vi.waitFor(() => expect(gatedStore.units).not.toBe(unitsBeforeClearRefresh));
    expect(pending.length).toBe(0);

    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });
});

describe("closed-state summary strip", () => {
  test("count chips read the parenthetical format and tapping one opens the sheet with the selection untouched", async () => {
    await applySelection(["1", "5", "3"]);
    render(MobileFilterSheet, { props: { store } });

    const chip = screen.getByRole("button", { name: "Ward (3 selected)" });
    expect(chip).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();

    await userEvent.click(chip);
    await tick();

    expect(uiState.filterSheetOpen).toBe(true);
    expect(store.selection.ward).toEqual(["1", "5", "3"]);
  });

  test("the strip clear-all empties the selection and disappears with it", async () => {
    await applySelection(["1"]);
    render(MobileFilterSheet, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await tick();

    expect(store.selection).toEqual({});
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ward \(/ })).not.toBeInTheDocument();
  });

  test("an empty selection renders the strip with no chips and no clear-all", () => {
    render(MobileFilterSheet, { props: { store } });

    expect(screen.getByRole("region", { name: m.filter_region_label() })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /selected\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });

  test("opening the sheet replaces the strip, which keeps the sheet's own clear-all interior", async () => {
    await applySelection(["1"]);
    render(MobileFilterSheet, { props: { store } });

    uiState.filterSheetOpen = true;
    await tick();

    expect(screen.getByTestId("filter-sheet")).toBeInTheDocument();
    expect(document.querySelector(".summary-row")).toBeNull();
    // The sheet interior keeps its filter bar with its own clear-all.
    expect(screen.getAllByRole("button", { name: "Clear all filters" }).length).toBeGreaterThan(0);
  });

  test("the +N more chip appears when chips overflow and opens the sheet", async () => {
    overflowMocks.partition = () => ({ visibleCount: 1, hiddenCount: 2 });
    await applySelection(["1", "5", "3"]);
    render(MobileFilterSheet, { props: { store } });
    await tick();

    const more = screen.getByRole("button", { name: "+2 more" });
    await userEvent.click(more);
    await tick();

    expect(uiState.filterSheetOpen).toBe(true);
  });

  test("at zero visible chips the disclosure trigger leads the strip (first child)", async () => {
    overflowMocks.partition = () => ({ visibleCount: 0, hiddenCount: 2 });
    await applySelection(["1", "5"]);
    render(MobileFilterSheet, { props: { store } });
    await tick();

    const first = document.querySelector(".strip-scroll ul > *");
    expect(first?.classList.contains("more-trigger")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "+2 more" }));
    await tick();
    expect(uiState.filterSheetOpen).toBe(true);
  });

  test("no overflow means no +N more chip on the strip", async () => {
    // Meaningful no-overflow partition (not jsdom's all-zero rects): the
    // mocked measurement reports everything visible.
    overflowMocks.partition = (widths: number[]) => ({
      visibleCount: widths.length,
      hiddenCount: 0,
    });
    await applySelection(["1"]);
    render(MobileFilterSheet, { props: { store } });
    await tick();

    expect(screen.queryByRole("button", { name: /\+\d+ more/ })).not.toBeInTheDocument();
  });

  test("the strip's clear-all keeps focus on the strip when the button unmounts", async () => {
    await applySelection(["1"]);
    render(MobileFilterSheet, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await tick();

    expect(store.selection).toEqual({});
    expect(document.activeElement).toBe(document.querySelector(".summary-row"));
  });

  test("closing the sheet returns focus to the count chip that opened it", async () => {
    await applySelection(["5"]);
    render(MobileFilterSheet, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: "Ward (1 selected)" }));
    await tick();
    expect(uiState.filterSheetOpen).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Close filters" }));
    await tick();
    await tick();

    expect(uiState.filterSheetOpen).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ward (1 selected)" }));
    expect(document.activeElement).not.toBe(document.body);
  });
});
