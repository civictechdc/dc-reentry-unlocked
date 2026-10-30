import { expect, type Page } from "@playwright/test";
import { When, Then } from "./bdd.ts";
import { openApp, expectResultsLoaded } from "./app.steps.ts";

/**
 * Golden-path steps for the error-surface scenarios: plain-language 404 for
 * unknown routes, and a retry banner with retained results when the
 * backend becomes unreachable mid-session. The unreachable backend is
 * simulated with Playwright route aborts on the units endpoint (the
 * transport failure the UI must degrade on), noted in the step below.
 */

When("a user navigates to a nonexistent route", async ({ page }: { page: Page }) => {
  await page.goto("/definitely-not-a-route");
});

Then(
  "a plain-language 404 page appears; no stack traces or internal errors are exposed",
  async ({ page }: { page: Page }) => {
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText(/We couldn't find that page/)).toBeVisible();
    const back = page.getByRole("link", { name: "Back to available units" });
    await expect(back).toHaveAttribute("href", "/");
    // No runtime chatter: no stack trace or internal error text leaks into
    // the rendered page.
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body).not.toMatch(/at .+?\(\d+:\d+\)/);
    expect(body.toLowerCase()).not.toContain("stack");
  },
);

When("the API becomes unreachable after results loaded", async ({ page }: { page: Page }) => {
  await openApp(page);
  await expectResultsLoaded(page);
  // Simulation note (this is deliberate tooling, not the real backend):
  // every further units request is aborted at the network level — the same
  // transport failure an unreachable container produces. Applying another
  // filter selection then triggers a refresh that hits the abort.
  await page.route(/\/units(\?|$)/, (route) => route.abort());
  await page.locator(".filter-bar").getByRole("button", { name: "Ward 1" }).click();
});

Then(
  "the UI shows a retry banner and retains the last rendered results where possible",
  async ({ page }: { page: Page }) => {
    const list = page.locator(".unit-list");
    await expect(list.locator(".retry-banner")).toBeVisible({ timeout: 20_000 });
    await expect(
      list.locator(".retry-banner").getByText("We couldn't reach the housing service"),
    ).toBeVisible();
    // Last results still rendered: the failure never blanks the list.
    await expect(page.locator(".unit-list article").first()).toBeVisible();
    await expect(list.getByRole("button", { name: "Try again" })).toBeVisible();
  },
);
