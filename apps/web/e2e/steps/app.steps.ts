import { expect, type Page } from "@playwright/test";

/**
 * Shared app-open helpers used by every golden-path feature: the shell
 * booted fully (prototype banner visible) and the card list holding
 * results.
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("Prototype with synthetic data")).toBeVisible({
    timeout: 20_000,
  });
}

/** Results are flowing: the card list renders the available units. */
export async function expectResultsLoaded(page: Page): Promise<void> {
  await expect(page.locator(".unit-list article").first()).toBeVisible({
    timeout: 20_000,
  });
}
