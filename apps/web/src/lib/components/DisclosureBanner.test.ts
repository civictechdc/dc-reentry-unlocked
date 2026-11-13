import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import { SYNTHETIC_DISCLOSURE } from "@dc-reentry/shared";
import { afterEach, describe, expect, test } from "vitest";
import { m } from "#lib/paraglide/messages.js";
import DisclosureBanner from "./DisclosureBanner.svelte";

afterEach(() => cleanup());

describe("the disclosure banner", () => {
  test("renders the shared contract's synthetic-data sentence as its body", () => {
    // Arrange: the banner is the always-present disclosure surface
    // Act: render it standalone
    render(DisclosureBanner);

    // Assert: the body carries the contract sentence exactly — byte-exact
    // from @dc-reentry/shared, not a catalog or local copy
    const banner = screen.getByRole("note");
    expect(within(banner as HTMLElement).getByText(SYNTHETIC_DISCLOSURE)).toBeInTheDocument();
  });

  test("keeps the catalog heading above the contract sentence", () => {
    // Arrange: the heading stays catalog-driven (region-label and heading keys untouched)
    // Act: render it standalone
    render(DisclosureBanner);

    // Assert: the catalog heading renders inside the note landmark
    const banner = screen.getByRole("note");
    expect(within(banner as HTMLElement).getByText(m.banner_heading())).toBeInTheDocument();
  });
});
