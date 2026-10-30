import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { m } from "#lib/paraglide/messages.js";
import ActiveChips from "./ActiveChips.svelte";

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
});
