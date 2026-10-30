import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS, wardOptions } from "@dc-reentry/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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

  test("clear-all empties the selection", async () => {
    store.filtersSchema = UNIT_FILTERS;
    store.selection = { ward: ["1", "5"] as never };
    render(FilterBar, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(store.selection).toEqual({});
  });
});
