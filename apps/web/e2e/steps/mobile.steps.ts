import { expect, type Page } from "@playwright/test";
import { When, Then } from "./bdd.ts";
import { openApp } from "./app.steps.ts";

/**
 * Golden-path steps for the mobile responsive scenario: at phone width the
 * app switches to Map/List tabbed navigation, a filter sheet, and a
 * full-screen bottom-sheet detail — nothing desktop has is lost.
 */

const PHONE_VIEWPORT = { width: 390, height: 844 };

When("the app is used at phone width", async ({ page }: { page: Page }) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await openApp(page);
  // The tab layout replaced the desktop split view: the list is off-screen.
  await expect(page.getByTestId("map-view")).toBeVisible();
  await expect(page.locator(".unit-list")).not.toBeVisible();
});

Then(
  "map and list remain fully operable through tabs, filters through the sheet, and detail through the bottom sheet",
  async ({ page }: { page: Page }) => {
    // Tabs drive the two full-screen views — list shows cards, map returns.
    await page.getByRole("tab", { name: "List" }).click();
    await expect(page.locator(".unit-list article").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByTestId("map-view")).toBeVisible();

    // Filters through the full-screen sheet, selection chips applied.
    await page.getByRole("button", { name: "Filters" }).click();
    const sheet = page.getByTestId("filter-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Ward 1" }).click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();

    // Detail through the full-width bottom sheet, closable back to the list.
    await page.getByRole("tab", { name: "List" }).click();
    await page.getByRole("article").first().getByRole("button").first().click();
    const detail = page.getByTestId("unit-detail");
    await expect(detail).toBeVisible();
    const sheetHeight = (await detail.boundingBox())?.height ?? 0;
    expect(sheetHeight, "the detail sheet fills the phone viewport").toBeGreaterThanOrEqual(700);

    await page.getByRole("button", { name: "Close unit details" }).click();
    await expect(detail).not.toBeVisible();
  },
);
