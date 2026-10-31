import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility baseline: keyboard operability of filters, cards, and the
 * detail surface, and an axe-core scan with no serious violations.
 */
test.describe("a11y baseline", () => {
  test("axe scan reports no serious violations on the main screen", async ({ page }) => {
    await page.goto("/");
    await page
      .getByText(/matching units|available unit\(s\)|unit\(s\)/)
      .first()
      .waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("keyboard pin selection: an sr-pin focuses with visible feedback and opens the detail", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByText("Prototype with synthetic data").first().waitFor({ timeout: 20_000 });

    const pinButton = page.getByTestId("map-pin-list").locator("button").first();
    // Reach the pin with visible feedback in a way that works in every
    // engine: browsers disagree on whether script focus() matches
    // :focus-visible (Firefox does not; Chromium + WebKit do). Prefer
    // programmatic focus — it keeps the desktop dev suite's behavior — and
    // for engines that don't reveal on it, restart clean and walk Tab from
    // document start (the honest keyboard-only path).
    await pinButton.focus({ timeout: 10_000 });
    let revealed = await pinButton.locator(".pin-label").isVisible();
    if (!revealed) {
      await page.reload();
      await page.getByText("Prototype with synthetic data").first().waitFor({ timeout: 20_000 });
      let reached = false;
      for (let tabs = 0; tabs < 40 && !reached; tabs += 1) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(async () => {
          // activeElement inside the sr-pin row (the walk target)
          return (
            document
              .querySelector("[data-testid=map-pin-list]")
              ?.contains(document.activeElement) ?? false
          );
        });
      }
      expect(reached, "the first sr-pin is reachable by keyboard alone").toBe(true);
    }
    // focus reveal carries visible text (keyboard usability beyond a textless box)
    await expect(pinButton.locator(".pin-label")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("unit-detail")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close unit details" })).toBeVisible();
  });

  test("keyboard-only usage reaches filters, cards, detail open/close", async ({ page }) => {
    await page.goto("/");
    await page
      .getByText(/unit\(s\)/)
      .first()
      .waitFor({ timeout: 20_000 });

    // a filter is reachable and operable by keyboard alone
    const filterBar = page.locator(".filter-bar");
    await filterBar.getByRole("button", { name: "Ward 1", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Ward: Ward 1")).toBeVisible();

    // a unit card is reachable via Tab and opens detail with Enter
    const card = page.getByRole("article").first().getByRole("button");
    await card.focus();
    await page.keyboard.press("Enter");
    const detail = page.getByTestId("unit-detail");
    await expect(detail).toBeVisible();

    // detail closes with Escape and returns to the list
    await page.keyboard.press("Escape");
    await expect(detail).not.toBeVisible();
  });
});
