import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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
  return aUnit()
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

describe("zero-bedroom presentation vocabulary", () => {
  test("presents a zero-bedroom efficiency as Studio on the card", () => {
    store.units = [aUnit().withId("studio-1").withBedrooms(0).build()];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(within(card as HTMLElement).getByText(m.bedrooms_value_studio())).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText(m.card_bedrooms({ bedrooms: 0 })),
    ).not.toBeInTheDocument();
  });

  test("presents a zero-bedroom shared-room as the bed-available vocabulary on the card", () => {
    store.units = [aUnit().withId("shared-1").withBedrooms(0).withRoomType("shared-room").build()];
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
      aUnit().withId("private-1").withBedrooms(1).withRoomType("private-room").build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(m.card_bedrooms({ bedrooms: 1 })),
    ).toBeInTheDocument();
  });

  test("presents a two-bedroom apartment as the numeric bedroom count on the card", () => {
    store.units = [aUnit().withId("apartment-1").withBedrooms(2).withRoomType("apartment").build()];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const card = screen.getByRole("article", { name: /Fresh Start Transitional/ });
    expect(
      within(card as HTMLElement).getByText(m.card_bedrooms({ bedrooms: 2 })),
    ).toBeInTheDocument();
  });

  test("presents a one-bedroom shared-room as the numeric bedroom count on the card", () => {
    store.units = [
      aUnit().withId("shared-1br").withBedrooms(1).withRoomType("shared-room").build(),
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
    store.units = [aUnit().withId("known-type").build()];
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
    store.units = [aUnit().withId("unknown-type").withUnknownHousingType().build()];
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
      aUnit().withId("unit-2").inWard(2).withCost(430).needsVerification().build(),
    ];
    store.phase = "ready";
    render(UnitCardList, { props: { store } });

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(
      within(cards[0] as HTMLElement).getByText(m.card_bedrooms({ bedrooms: 1 })),
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
