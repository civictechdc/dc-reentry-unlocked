import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnitCard } from "@dc-reentry/shared/testing";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { tick } from "svelte";
import { m } from "#lib/paraglide/messages.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import DetailSlideOver from "./DetailSlideOver.svelte";
import UnitCardList from "./UnitCardList.svelte";

class FakeTransport {
  cards: ReturnType<typeof makeCard>[] = [];
  async filters() {
    return UNIT_FILTERS;
  }
  async units() {
    return this.cards;
  }
}

function makeCard(
  overrides: { id?: string; cost?: number; ward?: number; needsVerification?: boolean } = {},
) {
  return aUnitCard()
    .withId(overrides.id ?? "unit-1")
    .withCost(overrides.cost ?? 650)
    .inWard(overrides.ward ?? 1)
    .confirmed()
    .build();
}

let store: HousingStore;

beforeEach(async () => {
  uiState.selectedUnitId = null;
  store = new HousingStore(new FakeTransport() as never);
  await store.initialize();
});

afterEach(() => cleanup());

describe("zero-panel focus continuity (rejecting transport)", () => {
  test("removing the zero panel's lone chip holds focus on the panel immediately and after a failed refresh settles", async () => {
    // Boot with an EMPTY result set (zero panel) on a healthy transport,
    // then make every subsequent units request REJECT — the removal's
    // refresh fails, the zero result stays, and the panel must hold focus
    // (the count line it would hand off to never mounts).
    let rejectUnits = false;
    const flakyTransport = {
      filters: async () => UNIT_FILTERS,
      units: async () => {
        if (rejectUnits) throw new TypeError("fetch failed");
        return [];
      },
    };
    const failingStore = new HousingStore(flakyTransport as never);
    await failingStore.initialize();
    await failingStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["8"],
    });
    render(UnitCardList, { props: { store: failingStore } });

    const zeroPanel = document.querySelector(".zero-panel") as HTMLElement;
    const removeChip8 = screen.getByRole("button", {
      name: m.chip_remove({ filter: "Ward", value: "Ward 8" }),
    });

    // From here on every units request rejects: the removal's refresh fails,
    // the zero result stays, and the count line never mounts.
    rejectUnits = true;

    // Native, un-awaited click: the handler suspends in the pending apply —
    // the panel already holds focus synchronously.
    removeChip8.click();
    expect(document.activeElement).toBe(zeroPanel);

    // The refresh rejects (zero result stays): after the dust settles the
    // panel STILL holds focus — never the page body.
    await tick();
    await tick();
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(zeroPanel);
    expect(document.querySelector(".zero-panel")).not.toBeNull();
    expect(document.querySelector(".result-count")).toBeNull();
  });
});

describe("zero-panel render-transition focus handoff", () => {
  test("a second removal queued behind the first strands no body focus when the first response recovers results", async () => {
    // Every units request parks in a queue; responses are released by hand.
    // The store coalesces an in-flight refresh, so the SECOND removal's
    // handler awaits the same cycle as the first — only the render
    // transition can restore focus before the second fetch lands.
    const pending: Array<(units: ReturnType<typeof makeCard>[]) => void> = [];
    const transport = {
      filters: async () => UNIT_FILTERS,
      units: async () =>
        new Promise<ReturnType<typeof makeCard>[]>((resolve) => {
          pending.push(resolve);
        }),
    };
    const gatedStore = new HousingStore(transport as never);
    void gatedStore.initialize();
    await waitFor(() => expect(pending.length).toBe(1));
    pending.shift()!([]);
    render(UnitCardList, { props: { store: gatedStore } });
    await waitFor(() => expect(document.querySelector(".zero-panel")).not.toBeNull());

    // Two chips; the apply's own refresh settles on the zero result too.
    void gatedStore.apply({
      kind: "apply",
      filterId: "ward",
      control: "multi-select",
      values: ["8", "6"],
    });
    await waitFor(() => expect(pending.length).toBe(1));
    pending.shift()!([]);

    // TWO quick native removals: the second is coalesced into the first's
    // refresh cycle, so its handler stays suspended until both fetches land.
    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 8" }) })
      .click();
    await waitFor(() => expect(pending.length).toBe(1));
    screen
      .getByRole("button", { name: m.chip_remove({ filter: "Ward", value: "Ward 6" }) })
      .click();
    await waitFor(() => expect(pending.length).toBe(1));

    // Release ONLY the first removal's response: results recover, the panel
    // unmounts, and the focused chip goes with it.
    pending.shift()!([makeCard({ id: "unit-1" }), makeCard({ id: "unit-2" })]);
    await waitFor(() => expect(document.querySelector(".zero-panel")).toBeNull());
    // The second fetch is still pending here — no continuation has run yet.
    expect(pending.length).toBe(1);

    // The render transition already handed focus to the count line.
    const countLine = document.querySelector(".result-count") as HTMLElement;
    expect(document.activeElement).toBe(countLine);

    // The second response settles: focus is not yanked.
    pending.shift()!([makeCard({ id: "unit-1" }), makeCard({ id: "unit-2" })]);
    await waitFor(() => expect(gatedStore.phase).toBe("ready"));
    await tick();
    expect(document.activeElement).toBe(countLine);
  });
});

describe("zero-bedroom presentation vocabulary", () => {
  test("presents a zero-bedroom efficiency as Studio on the card", () => {
    store.units = [aUnitCard().withId("studio-1").withBedrooms(0).build()];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(within(card as HTMLElement).getByText(m.bedrooms_value_studio())).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(m.card_bedrooms({ bedrooms: 0 })),
    ).not.toBeInTheDocument();
  });

  test("presents a zero-bedroom shared-room as the bed-available vocabulary on the card", () => {
    store.units = [
      aUnitCard().withId("shared-1").withBedrooms(0).withRoomType("shared-room").build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(m.bedrooms_value_bed_available()),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(m.card_bedrooms({ bedrooms: 0 })),
    ).not.toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(m.bedrooms_value_studio()),
    ).not.toBeInTheDocument();
  });

  test("presents a one-bedroom private-room as the numeric bedroom count on the card", () => {
    store.units = [
      aUnitCard().withId("private-1").withBedrooms(1).withRoomType("private-room").build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(m.card_bedrooms({ bedrooms: 1 })),
    ).toBeInTheDocument();
  });

  test("presents a two-bedroom apartment as the numeric bedroom count on the card", () => {
    store.units = [
      aUnitCard().withId("apartment-1").withBedrooms(2).withRoomType("apartment").build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(m.card_bedrooms({ bedrooms: 2 })),
    ).toBeInTheDocument();
  });

  test("presents a one-bedroom shared-room as the numeric bedroom count on the card", () => {
    store.units = [
      aUnitCard().withId("shared-1br").withBedrooms(1).withRoomType("shared-room").build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(m.card_bedrooms({ bedrooms: 1 })),
    ).toBeInTheDocument();
  });
});

describe("card housing-type presentation through the list", () => {
  test("shows the real housing-type label on the card row for a known housing type", () => {
    store.units = [aUnitCard().withId("known-type").build()];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(
        m.card_housing_type({ type: m.taxonomy_housing_transitional() }),
      ),
    ).toBeInTheDocument();
  });

  test("shows the honest unknown marker on the card row for an unlisted housing type", () => {
    store.units = [aUnitCard().withId("unknown-type").withUnknownHousingType().build()];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(
        m.card_housing_type({ type: m.detail_value_unknown() }),
      ),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(
        m.card_housing_type({ type: m.taxonomy_housing_transitional() }),
      ),
    ).not.toBeInTheDocument();
  });

  test("a housing type newer than the vocabulary renders its humanized value on the card row, never the honest unknown", () => {
    // Arrange: a card carrying a taxonomy value this build never compiled
    // (test-local widening: no type for the future value exists here)
    store.units = [
      aUnitCard()
        .withId("future-type")
        .withProgram({ housingType: "rapid-rehousing" } as never)
        .build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    // Act: find the card row in the rendered list
    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });

    // Assert: the humanized published value, never the unknown marker
    expect(
      within(card as HTMLElement).getByText(m.card_housing_type({ type: "Rapid rehousing" })),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(
        m.card_housing_type({ type: m.detail_value_unknown() }),
      ),
    ).not.toBeInTheDocument();
  });
});

describe("unit card list states", () => {
  test("shows skeleton loading while nothing has loaded yet", () => {
    store.units = null;
    store.phase = "loading";
    const { container } = render(UnitCardList, { props: { store } });

    expect(container.querySelectorAll(".skeleton-box").length).toBeGreaterThan(0);
    expect(screen.getByText(m.results_loading())).toBeInTheDocument();
  });

  test("renders loaded cards that scan without opening detail", async () => {
    store.units = [
      makeCard({ id: "unit-1", cost: 650, ward: 5 }),
      aUnitCard().withId("unit-2").inWard(2).withCost(430).needsVerification().build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    // the default card is a zero-bedroom efficiency, presented as Studio
    expect(
      within(cards[0] as HTMLElement).getByText(m.bedrooms_value_studio()),
    ).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText(m.card_ward({ ward: 5 }))).toBeInTheDocument();
    expect(
      within(cards[0] as HTMLElement).getByText(m.card_cost({ cost: 650 })),
    ).toBeInTheDocument();
    expect(
      within(cards[0] as HTMLElement).getByText("Fresh Start Transitional"),
    ).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("Fresh Start Housing")).toBeInTheDocument();
    // verification badge mapping
    expect(within(cards[0] as HTMLElement).getByText(m.card_badge_confirmed())).toBeInTheDocument();
    expect(
      within(cards[1] as HTMLElement).getByText(m.card_badge_needs_verification()),
    ).toBeInTheDocument();
    // count line
    expect(screen.getByText(m.results_count({ count: 2 }))).toBeInTheDocument();
  });

  test("selecting a card opens the detail slide-over", async () => {
    store.units = [makeCard({ id: "unit-1" })];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });
    render(DetailSlideOver, { props: { store } });

    await userEvent.click(
      within(screen.getByRole("article", { name: /Fresh Start Transitional/ })).getByRole("button"),
    );
    expect(uiState.selectedUnitId).toBe("unit-1");
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();
  });

  test("shows the retry panel when nothing ever loaded and the backend is unreachable", () => {
    store.units = null;
    store.phase = "error";
    render(UnitCardList, { props: { store } });

    expect(screen.getByText(m.results_error_headline())).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.results_retry() })).toBeInTheDocument();
  });

  test("zero results renders the no-matches panel offering chip removal", async () => {
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    store.units = [];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    expect(screen.getByText(m.results_zero_headline())).toBeInTheDocument();
    expect(screen.getByText(m.results_zero_body())).toBeInTheDocument();
    expect(screen.getByText("Ward: Ward 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.chip_clear_all() })).toBeInTheDocument();
  });

  test("a successful zero-result load followed by a failing refresh keeps the zero context and offers retry", async () => {
    // first load: a filter selection matches nothing (successful, zero results)
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["1"] });
    store.units = [];
    store.phase = "ready";
    const mounted = render(UnitCardList, { props: { store } });
    expect(screen.getByText(m.results_zero_headline())).toBeInTheDocument();

    // then the backend goes down: the zero context stays honestly rendered,
    // the failure surface appears, and the retry affordance is available
    store.phase = "error";
    store.failure = { scope: "units", reason: "unreachable" };
    mounted.rerender({ store });
    expect(screen.getByText(m.results_zero_headline())).toBeInTheDocument();
    expect(screen.getByText(m.results_error_headline())).toBeInTheDocument();
    expect(screen.getByText(m.results_error_body())).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.results_retry() })).toBeInTheDocument();
    // zero-results relax controls remain available in the degraded state
    expect(screen.getByText("Ward: Ward 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.chip_clear_all() })).toBeInTheDocument();
  });

  test("an error after loaded results keeps those results and adds a retry banner", () => {
    store.units = [makeCard({ id: "unit-1" })];
    store.phase = "error";
    render(UnitCardList, { props: { store } });

    expect(screen.getByText(m.results_count({ count: 1 }))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: m.results_retry() })).toBeInTheDocument();
  });
});

describe("zero-panel focus continuity", () => {
  test("removing the zero panel's last chip lands focus on the recovered count line", async () => {
    const transport = new FakeTransport();
    transport.cards = [];
    store = new HousingStore(transport as never);
    await store.initialize();
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["8"] });
    render(UnitCardList, { props: { store } });

    const removeChip8 = screen.getByRole("button", {
      name: m.chip_remove({ filter: "Ward", value: "Ward 8" }),
    });
    transport.cards = [makeCard({ id: "recovered", ward: 1 })];
    await userEvent.click(removeChip8);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByText(m.results_count({ count: 1 })));
    });
  });

  test("the zero panel's clear-all lands focus on the recovered count line", async () => {
    const transport = new FakeTransport();
    transport.cards = [];
    store = new HousingStore(transport as never);
    await store.initialize();
    await store.apply({ kind: "apply", filterId: "ward", control: "multi-select", values: ["8"] });
    render(UnitCardList, { props: { store } });

    const clearAll = screen.getByRole("button", { name: m.chip_clear_all() });
    transport.cards = [makeCard({ id: "recovered", ward: 1 })];
    await userEvent.click(clearAll);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByText(m.results_count({ count: 1 })));
    });
  });
});
