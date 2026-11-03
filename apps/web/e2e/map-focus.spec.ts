import { expect, test, type Page } from "@playwright/test";
import { CARD_FOCUS_ZOOM } from "../src/lib/map/map-config.ts";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";

/**
 * Camera focus on card selection, observed through the map section's camera
 * attributes (data-map-center as `"<lng>,<lat>"`, data-map-zoom as a number
 * string, refreshed on the map's moveend): every selection path — mouse
 * click, keyboard Enter on a card, Enter on a keyboard pin — flies the
 * camera to the selected unit's pin at the card-focus zoom, and a selection
 * made while the map is unmounted (phone list tab) opens the camera already
 * focused at the next map mount.
 */

/** flyTo lands exactly on the pin; the tolerance absorbs serialization only. */
const NEARNESS_TOLERANCE = 1e-4;
const FOCUS_WAIT = { timeout: 20_000 };
const API_BASE = process.env.VITE_API_URL ?? "http://localhost:3000";

type CameraUnit = { id: string; coordinates: { latitude: number; longitude: number } };

/**
 * The unit behind the first card: the card's heading anchor carries the unit
 * id (`card-title-<unit.id>`), which resolves unambiguously against the
 * served result set even where addresses repeat across programs.
 */
async function unitBehindFirstCard(page: Page): Promise<CameraUnit> {
  const article = page.getByRole("article").first();
  const labelledby = await article.getAttribute("aria-labelledby");
  expect(labelledby, "card heading anchor embeds the unit id").toContain("card-title-");
  const unitId = labelledby!.replace(/^card-title-/, "");
  const response = await page.request.get(`${API_BASE}/units`);
  const { units } = (await response.json()) as { units: CameraUnit[] };
  const unit = units.find((candidate) => candidate.id === unitId);
  expect(unit, "the selected card's unit is in the served result set").toBeTruthy();
  return unit!;
}

/** The camera settled on the unit's pin: focus zoom, center within tolerance. */
async function expectCameraFocusedOn(page: Page, unit: CameraUnit): Promise<void> {
  const map = page.getByTestId("map-view");
  await expect(map).toHaveAttribute("data-map-zoom", String(CARD_FOCUS_ZOOM), FOCUS_WAIT);
  const [lng, lat] = (await map.getAttribute("data-map-center"))!.split(",").map(Number) as [
    number,
    number,
  ];
  expect(
    Math.abs(lng - unit.coordinates.longitude),
    "camera longitude sits on the unit's pin",
  ).toBeLessThan(NEARNESS_TOLERANCE);
  expect(
    Math.abs(lat - unit.coordinates.latitude),
    "camera latitude sits on the unit's pin",
  ).toBeLessThan(NEARNESS_TOLERANCE);
}

test.describe("camera focus follows card selection", () => {
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
