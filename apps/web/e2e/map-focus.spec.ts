import { expect, test } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";
import { expectCameraFocusedOn, unitBehindFirstCard } from "./steps/map.steps.ts";

/**
 * Camera focus on card selection, observed through the map section's camera
 * attributes (data-map-center as `"<lng>,<lat>"`, data-map-zoom as a number
 * string, refreshed on the map's moveend): every selection path — mouse
 * click, keyboard Enter on a card, Enter on a keyboard pin — flies the
 * camera to the selected unit's pin at the card-focus zoom, and a selection
 * made while the map is unmounted (phone list tab) opens the camera already
 * focused at the next map mount.
 */

test.describe("camera focus follows card selection", () => {
  // Desktop-pinned: the CI matrix also runs this spec from a phone project,
  // where the app renders the tab layout with the card list hidden — these
  // scenarios exercise the desktop side-by-side surface.
  test.use({ viewport: { width: 1280, height: 720 } });

  test("selecting a unit card with the mouse flies the map camera to the unit's pin at the card-focus zoom", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    await page.getByRole("article").first().getByRole("button").click();

    await expectCameraFocusedOn(page, unit);
  });

  test("activating a unit card with the keyboard focuses the camera identically to the mouse", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    const card = page.getByRole("article").first().getByRole("button");
    await card.focus();
    await page.keyboard.press("Enter");

    await expectCameraFocusedOn(page, unit);
  });

  test("activating the unit's keyboard pin focuses the camera identically to the mouse", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    // the keyboard pin list renders the same result set in the same order,
    // so the first pin belongs to the first card's unit
    const unit = await unitBehindFirstCard(page);

    const pinButton = page.getByTestId("map-pin-list").locator("button").first();
    await pinButton.focus();
    await page.keyboard.press("Enter");

    await expectCameraFocusedOn(page, unit);
  });
});

test.describe("camera focus on phone (map mounts after the selection)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a selection made on the list tab opens the map camera already focused on the unit's pin", async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole("tab", { name: "List" }).click();
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    // the detail bottom sheet opening on selection is expected; it covers
    // the tab row for pointer taps (pre-existing), so switch tabs the way a
    // keyboard user does — focus the tab and press Enter
    await page.getByRole("article").first().getByRole("button").click();
    await expect(page.getByTestId("unit-detail")).toBeVisible();
    // selection must not force a tab switch: the app stays on the list tab
    await expect(page.getByRole("tab", { name: "Map" })).not.toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("map-view")).not.toBeVisible();

    // the map is unmounted while the list tab is active — switching back
    // mounts it with the focused camera, no second interaction needed
    const mapTab = page.getByRole("tab", { name: "Map" });
    await mapTab.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("map-view")).toBeVisible();
    await expectCameraFocusedOn(page, unit);
  });
});
