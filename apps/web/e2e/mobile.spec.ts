import { expect, test } from "@playwright/test";

/**
 * Phone-width behavior: Map/List tabs (each full-screen), a horizontally
 * scrollable filter row with a filter sheet, and a full-screen bottom-sheet
 * detail. Recorded viewport 390×844 (iPhone-class).
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile behavior", () => {
  test("map and list tabs switch the full-screen view", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });

    // map tab active by default, list hidden
    await expect(page.getByTestId("map-view")).toBeVisible();
    const list = page.locator(".unit-list");
    await expect(list).not.toBeVisible();

    // switching to list shows cards
    await page.getByRole("tab", { name: "List" }).click();
    await expect(list).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();

    // switching back works too
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByTestId("map-view")).toBeVisible();
  });

  test("filter sheet opens the full-screen filters and applies a selection", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });

    await page.getByRole("button", { name: "Filters" }).click();
    const sheet = page.getByTestId("filter-sheet");
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "Ward 1" }).click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();

    // sheet closed, selection applied: chip visible in the summary row
    await expect(sheet).not.toBeVisible();
    await expect(page.getByText("Ward: 1")).toBeVisible();
  });

  test("detail opens as a full-screen bottom sheet while the tab layout holds", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });

    await page.getByRole("tab", { name: "List" }).click();
    await page
      .getByRole("button")
      .filter({ hasText: /Fresh Start|Transitional|Program/ })
      .first()
      .click();
    const detail = page.getByTestId("unit-detail");
    await expect(detail).toBeVisible();

    // full-screen: the sheet covers the viewport bottom sheet style
    const box = await detail.boundingBox();
    expect(box?.height, "bottom sheet fills the viewport").toBeGreaterThanOrEqual(700);

    await page.getByRole("button", { name: "Close unit details" }).click();
    await expect(detail).not.toBeVisible();
  });
});
