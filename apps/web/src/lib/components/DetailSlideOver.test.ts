import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { UNIT_FILTERS, type UnitCard } from "@dc-reentry/shared";
import { aUnit } from "@dc-reentry/shared/testing";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { tick } from "svelte";
import { m } from "#lib/paraglide/messages.js";
import { HousingStore } from "#lib/state/housing-store.svelte.ts";
import { uiState } from "#lib/state/ui-state.svelte.ts";
import { detailValueLabel } from "./detail-values.ts";
import DetailSlideOver from "./DetailSlideOver.svelte";

class FakeTransport {
  async filters() {
    return UNIT_FILTERS;
  }
  async units() {
    return [];
  }
}

/** Test-local reshaping (the shared builder leaves provider contacts default). */
function withContactStripped(card: UnitCard): UnitCard {
  return {
    ...card,
    provider: { id: card.provider.id, organization: card.provider.organization },
    program: { ...card.program, applicationProcess: undefined } as never,
  };
}

function withApplicationProcess(card: UnitCard, text: string): UnitCard {
  return { ...card, program: { ...card.program, applicationProcess: text } };
}

let store: HousingStore;

beforeEach(async () => {
  store = new HousingStore(new FakeTransport() as never);
  await store.initialize();
});

afterEach(() => cleanup());

describe("zero-bedroom presentation vocabulary", () => {
  test("presents a zero-bedroom efficiency as Studio in the detail bedrooms row", () => {
    store.units = [aUnit().withId("studio-1").withBedrooms(0).build()];
    uiState.selectedUnitId = "studio-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    const bedroomsRow = within(detail).getByText(m.detail_bedrooms()).closest(".row");
    expect(
      within(bedroomsRow as HTMLElement).getByText(m.bedrooms_value_studio()),
    ).toBeInTheDocument();
    expect(
      within(bedroomsRow as HTMLElement).queryByText(m.detail_bedrooms_value({ bedrooms: 0 })),
    ).not.toBeInTheDocument();
  });

  test("presents a zero-bedroom shared-room as the bed-available vocabulary in the detail bedrooms row", () => {
    store.units = [aUnit().withId("shared-1").withBedrooms(0).withRoomType("shared-room").build()];
    uiState.selectedUnitId = "shared-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    const bedroomsRow = within(detail).getByText(m.detail_bedrooms()).closest(".row");
    expect(
      within(bedroomsRow as HTMLElement).getByText(m.bedrooms_value_bed_available()),
    ).toBeInTheDocument();
    expect(
      within(bedroomsRow as HTMLElement).queryByText(m.detail_bedrooms_value({ bedrooms: 0 })),
    ).not.toBeInTheDocument();
    expect(
      within(bedroomsRow as HTMLElement).queryByText(m.bedrooms_value_studio()),
    ).not.toBeInTheDocument();
  });

  test("presents a one-bedroom private-room as the numeric bedroom count in the detail bedrooms row", () => {
    store.units = [
      aUnit().withId("private-1").withBedrooms(1).withRoomType("private-room").build(),
    ];
    uiState.selectedUnitId = "private-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    const bedroomsRow = within(detail).getByText(m.detail_bedrooms()).closest(".row");
    expect(
      within(bedroomsRow as HTMLElement).getByText(m.detail_bedrooms_value({ bedrooms: 1 })),
    ).toBeInTheDocument();
  });

  test("presents a two-bedroom apartment as the numeric bedroom count in the detail bedrooms row", () => {
    store.units = [aUnit().withId("apartment-1").withBedrooms(2).withRoomType("apartment").build()];
    uiState.selectedUnitId = "apartment-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    const bedroomsRow = within(detail).getByText(m.detail_bedrooms()).closest(".row");
    expect(
      within(bedroomsRow as HTMLElement).getByText(m.detail_bedrooms_value({ bedrooms: 2 })),
    ).toBeInTheDocument();
  });

  test("presents a one-bedroom shared-room as the numeric bedroom count in the detail bedrooms row", () => {
    store.units = [
      aUnit().withId("shared-1br").withBedrooms(1).withRoomType("shared-room").build(),
    ];
    uiState.selectedUnitId = "shared-1br";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    const bedroomsRow = within(detail).getByText(m.detail_bedrooms()).closest(".row");
    expect(
      within(bedroomsRow as HTMLElement).getByText(m.detail_bedrooms_value({ bedrooms: 1 })),
    ).toBeInTheDocument();
  });
});

describe("unit detail slide-over", () => {
  test("renders unknown policy fields as the honest 'not publicly listed'", async () => {
    const card = aUnit()
      .withId("unit-1")
      .withUnknownReferralPolicy()
      .withUnknownSobrietyPolicy()
      .withUnknownHousingType()
      .build();
    store.units = [card];
    uiState.selectedUnitId = "unit-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    // honest unknowns — never a fabricated yes/no
    expect(within(detail).getAllByText(m.detail_value_unknown()).length).toBeGreaterThan(0);
    const row = within(detail)
      .getAllByRole("generic")
      .find((element) => element.textContent?.includes(m.detail_policy_referral()));
    expect(row?.textContent).toContain(m.detail_value_unknown());
    // the program name heading is present
    expect(within(detail).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Fresh Start Transitional",
    );
  });

  test("renders the complete provider contact block when it is fully known", () => {
    const card = withApplicationProcess(
      aUnit().withId("unit-1").build(),
      "Referral by phone, then an intake interview.",
    );
    store.units = [card];
    uiState.selectedUnitId = "unit-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    expect(within(detail).getByText("Fresh Start Housing")).toBeInTheDocument();
    expect(within(detail).getByText("(202) 555-0100")).toBeInTheDocument();
    expect(
      within(detail).getByRole("link", { name: "intake@freshstart.example.org" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("link", { name: "https://freshstart.example.org" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByText("Referral by phone, then an intake interview."),
    ).toBeInTheDocument();
  });

  test("missing contact details render 'not publicly listed', never fabricated data", () => {
    const card = withContactStripped(aUnit().withId("unit-2").build());
    store.units = [card];
    uiState.selectedUnitId = "unit-2";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    expect(
      within(detail).getAllByText(m.detail_contact_no_details()).length,
    ).toBeGreaterThanOrEqual(4);
  });

  test("size context renders the room type row with its message key", () => {
    const private_room = withApplicationProcess(
      aUnit().withId("unit-1").withRoomType("private-room").build(),
      "Referral phone.",
    );
    store.units = [private_room];
    uiState.selectedUnitId = "unit-1";
    render(DetailSlideOver, { props: { store } });

    const detail = screen.getByTestId("unit-detail");
    expect(within(detail).getByText(m.card_room_type())).toBeInTheDocument();
    expect(within(detail).getByText(m.card_room_type_private_room())).toBeInTheDocument();
  });

  test("a selection that leaves the result set closes the panel gracefully", async () => {
    store.units = [aUnit().withId("unit-1").build()];
    uiState.selectedUnitId = "unit-1";
    render(DetailSlideOver, { props: { store } });
    expect(screen.getByTestId("unit-detail")).toBeInTheDocument();

    // the narrowed result no longer contains the selected unit
    store.units = [aUnit().withId("unit-2").build()];
    await tick();
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    expect(uiState.selectedUnitId).toBeNull();
  });

  test("closing clears the pin and card hover highlights (return to prior list state)", async () => {
    store.units = [aUnit().withId("unit-1").build()];
    uiState.selectedUnitId = "unit-1";
    uiState.hoveredPinUnitId = "unit-1";
    uiState.hoveredCardUnitId = "unit-1";
    render(DetailSlideOver, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: m.detail_close() }));
    expect(uiState.hoveredPinUnitId).toBeNull();
    expect(uiState.hoveredCardUnitId).toBeNull();
  });

  test("closing returns to the list state (selection cleared)", async () => {
    store.units = [aUnit().withId("unit-1").build()];
    uiState.selectedUnitId = "unit-1";
    render(DetailSlideOver, { props: { store } });

    await userEvent.click(screen.getByRole("button", { name: m.detail_close() }));
    expect(uiState.selectedUnitId).toBeNull();
    expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
  });

  test("taxonomy labels resolve through messages with unknown staying honest", () => {
    expect(detailValueLabel("unknown")).toBe(m.detail_value_unknown());
    expect(detailValueLabel("yes")).toBe(m.detail_value_yes());
    expect(detailValueLabel("no")).toBe(m.detail_value_no());
    expect(detailValueLabel("transitional")).toBe(m.taxonomy_housing_transitional());
    expect(detailValueLabel("families")).toBe(m.taxonomy_population_families());
    expect(detailValueLabel("permanent-open-ended" as never)).toBe(m.taxonomy_length_permanent());
  });
});
