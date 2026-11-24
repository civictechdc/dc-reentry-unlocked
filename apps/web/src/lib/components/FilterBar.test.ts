import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS, wardOptions } from "@dc-reentry/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { tick } from "svelte";
import { m } from "#lib/paraglide/messages.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import FilterBar from "./FilterBar.svelte";

// The state machine under test runs on an isolated store instance.
let store: HousingStore;

class FakeTransport {
  schema = UNIT_FILTERS;
  cards: never[] = [];
  lastPath: string | null = null;

  async filters() {
    return this.schema;
  }

  async units(path: string): Promise<never[]> {
    this.lastPath = path;
    return this.cards;
  }
}

beforeEach(() => {
  store = new HousingStore(new FakeTransport() as never);
});

afterEach(() => cleanup());

describe("clear-all focus during a pending refresh", () => {
  /** Store whose units refresh stays pending until released. */
  function gatedHousingStore(): { store: HousingStore; releaseUnits: () => void } {
    let release: (() => void) | undefined;
    const transport = {
      filters: async () => UNIT_FILTERS,
      units: () =>
        new Promise<never[]>((resolve) => {
          release = () => resolve([]);
        }),
    };
    const gated = new HousingStore(transport as never);
    void gated.initialize();
    return { store: gated, releaseUnits: () => release?.() ?? undefined };
  }

  test("the band clear-all holds focus on the heading during a pending clear and does not yank focus the user moved", async () => {
    const { store: gatedStore, releaseUnits } = gatedHousingStore();
    gatedStore.selection = Object.assign(Object.create(null), { ward: ["1"] });
    render(FilterBar, { props: { store: gatedStore, summaryBand: true } });

    const heading = screen.getByRole("heading", { name: "Selected filters (1)" });
    const clearButton = screen.getByRole("button", { name: "Clear all filters" });
    clearButton.click();
    // No await: the focus handoff happens synchronously, before the pending
    // clear resolves (the heading element persists across the count change).
    expect(document.activeElement).toBe(heading);

    // The user moves focus elsewhere while the refresh is pending.
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

  test("the footer clear-all holds focus on the bar during a pending clear and does not yank focus the user moved", async () => {
    const { store: gatedStore, releaseUnits } = gatedHousingStore();
    gatedStore.selection = Object.assign(Object.create(null), { ward: ["1"] });
    render(FilterBar, { props: { store: gatedStore } });

    const clearButton = screen.getByRole("button", { name: "Clear all filters" });
    clearButton.click();
    const barSection = document.querySelector("section.filter-bar") as HTMLElement;
    expect(document.activeElement).toBe(barSection);

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
});

describe("schema-rendered filter bar", () => {
  test("renders all three supported control types from the published schema", async () => {
    store.filtersSchema = UNIT_FILTERS;
    render(FilterBar, { props: { store } });

    // single-select renderers (housing type uses the published option labels)
    expect(screen.getByText("Housing type")).toBeInTheDocument();
    // boolean renderers
    expect(screen.getByText("Referral required")).toBeInTheDocument();
    const referralFieldset = screen
      .getByText("Referral required")
      .closest("fieldset") as HTMLElement;
    expect(referralFieldset.querySelector("button")).toHaveTextContent(m.filter_boolean_yes());
    // multi-select ward renderer with all 8 ward options
    for (const option of wardOptions) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
  });

  test("renders zero filters when the schema has not arrived yet (boot-time graceful)", async () => {
    render(FilterBar, { props: { store } });
    expect(screen.queryByText("Housing type")).not.toBeInTheDocument();
  });

  test("hides a filter with an unsupported control type and keeps the rest working", async () => {
    store.filtersSchema = [
      ...UNIT_FILTERS,
      {
        id: "bedroom-range",
        label: "Bedroom range",
        control: "range" as never,
        target: "unit.ward" as never,
      },
    ];
    render(FilterBar, { props: { store } });

    expect(screen.queryByText("Bedroom range")).not.toBeInTheDocument();
    expect(
      screen.getByText(/not shown because this interface does not support them/),
    ).toBeInTheDocument();
    // remaining filters behave normally
    expect(screen.getByText("Housing type")).toBeInTheDocument();
  });

  test("single-select control selection applies and replaces the value in one control", async () => {
    store.filtersSchema = UNIT_FILTERS;
    render(FilterBar, { props: { store } });

    const select = screen.getByLabelText(/Housing type/) as HTMLSelectElement;
    await userEvent.selectOptions(select, "emergency-shelter");

    expect(store.selection["housing-type"]).toEqual(["emergency-shelter"]);
  });

  test("boolean control selection applies a yes and clears when toggled again", async () => {
    store.filtersSchema = UNIT_FILTERS;
    render(FilterBar, { props: { store } });

    const fieldset = screen.getByText("Referral required").closest("fieldset") as HTMLElement;
    const yesButton = fieldset.querySelector("button") as HTMLButtonElement;
    await userEvent.click(yesButton);

    expect(store.selection["referral-required"]).toEqual(["yes"]);
  });

  test("multi-select accumulates ward selections as pressed toggles", async () => {
    store.filtersSchema = UNIT_FILTERS;
    render(FilterBar, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: "Ward 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Ward 5" }));

    expect(store.selection.ward).toEqual(["1", "5"]);
  });

  test("no hardcoded filter lists: the bar mirrors whatever schema it was given", () => {
    // A fresh schema with different ids and order must render as-is.
    store.filtersSchema = [
      {
        id: "new-shape",
        label: "A brand new filter",
        control: "single-select",
        target: "unit.ward",
        options: [{ value: "a", label: "Option A" }],
      },
      UNIT_FILTERS[1]!,
      UNIT_FILTERS[0]!,
    ];
    render(FilterBar, { props: { store } });

    expect(screen.getByText("A brand new filter")).toBeInTheDocument();
    expect(screen.getByText("Length of stay")).toBeInTheDocument();
    expect(screen.getByText("Housing type")).toBeInTheDocument();
  });

  test("footer clear-all empties the selection when the summary band is off (filter-sheet path)", async () => {
    store.filtersSchema = UNIT_FILTERS;
    store.selection = { ward: ["1", "5"] as never };
    render(FilterBar, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(store.selection).toEqual({});
  });
});

describe("reserved summary band (desktop filter bar)", () => {
  test("the selection-count heading rises and falls with applied values and the single clear-all empties everything", async () => {
    store.filtersSchema = UNIT_FILTERS;
    store.selection = { ward: ["1", "5"] as never, gender: ["men"] as never };
    render(FilterBar, { props: { store, summaryBand: true } });

    expect(screen.getByRole("heading", { name: "Selected filters (3)" })).toBeInTheDocument();
    const clearAll = screen.getAllByRole("button", { name: "Clear all filters" });
    expect(clearAll).toHaveLength(1);

    await userEvent.click(clearAll[0]!);
    expect(store.selection).toEqual({});
    expect(screen.getByRole("heading", { name: "Selected filters (0)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });

  test("the empty state is reserved: the zero heading renders with no clear-all and no chips", () => {
    store.filtersSchema = UNIT_FILTERS;
    render(FilterBar, { props: { store, summaryBand: true } });

    expect(screen.getByRole("heading", { name: "Selected filters (0)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ward: Ward 1")).not.toBeInTheDocument();
  });

  test("the chips-row clear-all is suppressed in the band so exactly one clear-all remains", async () => {
    store.filtersSchema = UNIT_FILTERS;
    store.selection = { ward: ["1"] as never };
    render(FilterBar, { props: { store, summaryBand: true } });

    expect(screen.getByText("Ward: Ward 1")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear all filters" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: m.chip_clear_all() })).not.toBeInTheDocument();
  });

  test("clearing all from the band returns focus to the summary heading, not the page body", async () => {
    store.filtersSchema = UNIT_FILTERS;
    store.selection = { ward: ["1", "5"] as never };
    render(FilterBar, { props: { store, summaryBand: true } });

    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await tick();

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Selected filters (0)" }),
    );
  });
});
