import { expect, test, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";

/**
 * Result-feedback and focus-continuity contract (desktop 1280×720, phone
 * 390×844): one polite status region announces the matching-unit count on
 * apply and clear — agreeing with the zero panel on zero matches — and
 * keyboard removals on every chip surface (bounded band row, overflow
 * popover, zero-panel list) land focus on a logical neighbor, never the
 * page body. Removal accessible names identify filter and value everywhere.
 */

const statusRegion = (page: Page) => page.locator('p[role="status"]');

async function applyWardThroughFilterBar(page: Page, ward: string): Promise<void> {
  await page.locator(".filter-bar").getByRole("button", { name: ward, exact: true }).click();
  await expect(
    page
      .locator(".filter-bar")
      .getByRole("button", { name: ward, exact: true })
      .and(page.locator('[aria-pressed="true"]')),
  ).toBeVisible();
}

/**
 * The verified zero-match combination against the byte-frozen dataset
 * (emergency shelter + families + referral required + ward 6 → zero rows).
 */
async function applyZeroMatchSelection(page: Page): Promise<void> {
  const bar = page.locator(".filter-bar");
  // The combination is minimal: any other active selection can mask it.
  const clearAll = bar.getByRole("button", { name: "Clear all filters" });
  if (await clearAll.isVisible().catch(() => false)) {
    await clearAll.click();
    await expectResultsLoaded(page);
  }
  await page.selectOption("#filter-housing-type", { label: "Emergency shelter" });
  await page.selectOption("#filter-population", { label: "Families" });
  await bar
    .locator(".control-boolean")
    .filter({ hasText: "Referral required" })
    .getByRole("button", { name: "Yes" })
    .click();
  await bar.getByRole("button", { name: "Ward 6", exact: true }).click();
  const zeroPanel = page.locator(".unit-list .zero-panel");
  await expect(zeroPanel).toBeVisible();
  await expect.poll(() => statusRegion(page).textContent()).toContain("0 available unit");
}

test.describe("result feedback and focus continuity (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("removal accessible names identify filter and value on every chip surface", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    // Bounded band row chips.
    await applyWardThroughFilterBar(page, "Ward 1");
    await expect(
      page.locator(".summary-band").getByRole("button", { name: 'Remove "Ward: Ward 1"' }),
    ).toBeVisible();

    // Overflow popover chips: drive the row past its visible width.
    const bar = page.locator(".filter-bar");
    for (const ward of ["Ward 2", "Ward 3", "Ward 4", "Ward 5", "Ward 6", "Ward 7", "Ward 8"]) {
      await bar.getByRole("button", { name: ward, exact: true }).click();
    }
    await bar
      .locator(".control-boolean")
      .filter({ hasText: "Referral required" })
      .getByRole("button", { name: "Yes" })
      .click();
    await bar
      .locator(".control-boolean")
      .filter({ hasText: "Sobriety required" })
      .getByRole("button", { name: "Yes" })
      .click();
    const trigger = page.locator(".filter-bar").getByRole("button", { name: /\+\d+ more/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const popover = page.getByRole("group", { name: "More selected filters" });
    await expect(popover.getByRole("button", { name: 'Remove "Ward: Ward 2"' })).toBeVisible();
    await page.keyboard.press("Escape");

    // Zero-panel chips.
    await applyZeroMatchSelection(page);
    const zeroPanel = page.locator(".unit-list .zero-panel");
    await expect(zeroPanel.getByRole("button", { name: 'Remove "Ward: Ward 6"' })).toBeVisible();
  });

  test("a keyboard removal on a band row chip lands focus on the neighbor chip", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    await applyWardThroughFilterBar(page, "Ward 1");
    await applyWardThroughFilterBar(page, "Ward 5");

    const removeWard1 = page
      .locator(".summary-band")
      .getByRole("button", { name: 'Remove "Ward: Ward 1"' });
    await removeWard1.focus();
    await page.keyboard.press("Enter");

    await expect(
      page.locator(".summary-band").getByRole("button", { name: 'Remove "Ward: Ward 5"' }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });

  test("a keyboard removal on a zero-panel chip lands focus on the recovered count line", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    await applyZeroMatchSelection(page);

    const zeroPanel = page.locator(".unit-list .zero-panel");

    // Keyboard-removing a zero-panel chip recovers results: the panel's
    // owner hands focus to the recovered count line, never the page body.
    await zeroPanel
      .getByRole("button", { name: 'Remove "Housing type: Emergency shelter"' })
      .focus();
    await page.keyboard.press("Enter");
    const countLine = page.locator(".result-count");
    await expect(countLine).toBeVisible();
    await expect(countLine).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });

  test("the status region announces apply and clear and agrees with the zero panel", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const unfiltered = await statusRegion(page).textContent();
    expect(unfiltered).toContain("available unit");

    await applyWardThroughFilterBar(page, "Ward 1");
    await expect.poll(() => statusRegion(page).textContent()).not.toBe(unfiltered);
    // The announced count agrees with the visible count line.
    expect(await statusRegion(page).textContent()).toBe(
      await page.locator(".result-count").textContent(),
    );

    // Zero matches: the announcement says zero alongside the zero panel.
    await applyZeroMatchSelection(page);
    await expect.poll(() => statusRegion(page).textContent()).toContain("0 available unit");

    // Clear: the unfiltered count returns to the announcement, and focus
    // stays on the clear-all control the user activated.
    const clearAll = page
      .locator(".summary-band")
      .getByRole("button", { name: "Clear all filters" });
    await clearAll.click();
    await expect.poll(() => statusRegion(page).textContent()).toBe(unfiltered);
    // The unmounting button hands focus to the summary heading, not the body.
    await expect(page.getByRole("heading", { name: "Selected filters (0)" })).toBeFocused();
    await expectResultsLoaded(page);
  });

  test("the zero panel recovers results through chip-by-chip removal and through its clear-all", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    await applyZeroMatchSelection(page);

    // Chip by chip: dropping the ward value alone recovers results.
    await page
      .locator(".unit-list .zero-panel")
      .getByRole("button", { name: 'Remove "Ward: Ward 6"' })
      .click();
    await expect(page.locator(".result-count")).toBeVisible();
    await expect(page.locator(".unit-list article").first()).toBeVisible();
    await expect.poll(() => statusRegion(page).textContent()).not.toContain("0 available unit");

    // And through the panel's clear-all.
    await applyZeroMatchSelection(page);
    await page
      .locator(".unit-list .zero-panel")
      .getByRole("button", { name: "Remove all filter selections" })
      .click();
    await expect(page.locator(".result-count")).toBeVisible();
    await expect(page.locator(".unit-list article").first()).toBeVisible();
    await expect.poll(() => statusRegion(page).textContent()).not.toContain("0 available unit");
  });
});

test.describe("band clear-all focus with the units response held", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the band clear-all lands focus on the heading before the held response and stays where the user moved it", async ({
    page,
  }) => {
    // Hold unfiltered /units responses after the boot: only the clear's own
    // refresh (no ward filter in its query) may be held — a ward request
    // still in flight when the hold arms must pass through, or the clear
    // would join that cycle and no unfiltered request would ever be issued.
    // The route is installed AFTER the app has booted: no request is
    // intercepted during boot. Held requests are DEFERRED, never re-served.
    // Re-serving with route.fetch() + route.fulfill() left Firefox with the
    // app's unreachable-service alert at boot in CI on this cross-origin
    // API, so the held route simply continues when released and the browser
    // performs the request itself, with its own CORS handling, in every
    // engine.
    let holdNext = false;
    const held: Array<{ url: string; release: () => void }> = [];

    await openApp(page);
    await expectResultsLoaded(page);

    await page.route("**/units**", (route) => {
      if (!holdNext || route.request().url().includes("ward=")) {
        return route.continue();
      }
      held.push({
        url: route.request().url(),
        release: () => void route.continue(),
      });
    });

    // Select a ward first so the clear-all is visible, then hold + clear.
    const bar = page.locator(".filter-bar");
    const countLine = page.locator(".result-count");
    const unfilteredCount = await countLine.textContent();
    await bar.getByRole("button", { name: "Ward 1", exact: true }).click();
    await expect(page.getByText("Ward: Ward 1")).toBeVisible();
    // Arm the hold only after Ward 1's results have landed: the count line
    // shows the filtered count, so no ward request is still in flight.
    await expect.poll(() => countLine.textContent()).not.toBe(unfilteredCount);

    const heading = page.locator(".summary-heading");
    const clearAll = page
      .locator(".summary-band")
      .getByRole("button", { name: "Clear all filters" });

    holdNext = true;
    await clearAll.click();
    // The held request must be the clear's own refresh — the unfiltered
    // /units call, not the Ward 1 fetch that was still in flight when the
    // hold armed.
    await expect.poll(() => held.some((entry) => !entry.url.includes("ward="))).toBe(true);
    // Synchronous handoff: the heading holds focus before the response.
    await expect(heading).toBeFocused();

    // The user moves focus elsewhere while the response is pending.
    const toggle = bar.getByRole("button", { name: "Ward 1", exact: true });
    await toggle.focus();

    for (const { release } of held.splice(0)) release();
    // The clear's refresh has landed and its post-await logic has run once
    // the count line returns to the unfiltered text — never a fixed sleep.
    await expect.poll(() => countLine.textContent()).toBe(unfilteredCount);

    // Focus is NOT yanked back to the heading.
    await expect(toggle).toBeFocused();
  });
});

test.describe("result feedback on the phone map tab", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the status region announces on apply even while the card list is unmounted", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();

    const unfiltered = await statusRegion(page).textContent();
    expect(unfiltered).toContain("available unit");

    // Filter through the sheet; the map tab keeps the card list unmounted,
    // so the shell's status region is the only announcer.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const sheet = page.getByTestId("filter-sheet");
    await sheet.getByRole("button", { name: "Ward 1", exact: true }).click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();

    await expect.poll(() => statusRegion(page).textContent()).not.toBe(unfiltered);
    expect(await statusRegion(page).textContent()).toContain("available unit");
  });
});
