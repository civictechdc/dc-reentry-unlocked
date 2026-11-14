import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import { aUnitCard } from "@dc-reentry/shared/testing";
import { afterEach, describe, expect, test } from "vitest";
import { m } from "#lib/paraglide/messages.js";
import UnitCard from "./UnitCard.svelte";

afterEach(() => cleanup());

describe("card housing-type presentation", () => {
  test("shows the real housing-type label for a known housing type", () => {
    // Arrange: a program with a listed transitional housing type
    const card = aUnitCard().withHousingType("transitional").build();

    // Act: render the card on its own
    render(UnitCard, { props: { card } });

    // Assert: the card row resolves the taxonomy label, like the detail panel
    expect(
      screen.getByText(m.card_housing_type({ type: m.taxonomy_housing_transitional() })),
    ).toBeInTheDocument();
  });

  test("shows the honest unknown marker for an unlisted housing type", () => {
    // Arrange: a program whose housing type is unknown at the source
    const card = aUnitCard().withUnknownHousingType().build();

    // Act: render the card on its own
    render(UnitCard, { props: { card } });

    // Assert: the unknown marker, never an invented label
    const cardRow = screen.getByRole("article");
    expect(
      within(cardRow as HTMLElement).getByText(
        m.card_housing_type({ type: m.detail_value_unknown() }),
      ),
    ).toBeInTheDocument();
    expect(
      within(cardRow as HTMLElement).queryByText(
        m.card_housing_type({ type: m.taxonomy_housing_transitional() }),
      ),
    ).not.toBeInTheDocument();
  });
});
