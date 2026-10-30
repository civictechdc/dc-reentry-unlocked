import { expect, test } from "@playwright/test";

/**
 * Plain-language error page: unknown routes render the client-rendered 404
 * panel and never expose stack traces or internal error detail.
 */
test.describe("error surfaces", () => {
  test("an unknown route renders the plain-language 404 page", async ({ page }) => {
    await page.goto("/definitely-not-a-route");

    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText(/We couldn't find that page/)).toBeVisible();
    const back = page.getByRole("link", { name: "Back to available units" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/");
  });
});
