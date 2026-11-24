import { expect, test, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";

/**
 * Desktop filter-area geometry probes: the reserved summary band holds one
 * exact height, so applying, changing, removing, and clearing filters must
 * never move the map pane. Rects are compared with exact equality — every
 * edge and dimension — at two desktop viewports, and the page must keep
 * filling the viewport without overflow. A second describe covers the
 * overflow disclosure (the `+N more` trigger and its popover): it is
 * absolutely positioned, so activating it must not displace anything either.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

async function mapPaneRect(page: Page): Promise<Rect> {
  return page.locator(".map-pane").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    };
  });
}

async function summaryBandHeight(page: Page): Promise<number> {
  return page
    .locator(".summary-band")
    .evaluate((element) => element.getBoundingClientRect().height);
}

async function pageFillsViewport(page: Page): Promise<void> {
  const fill = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(fill.scrollHeight).toBeLessThanOrEqual(fill.innerHeight);
}

const viewports = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test.describe(`filter area geometry at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("the map pane holds one exact rect while filters are applied, changed, removed, and cleared", async ({
      page,
    }) => {
      await openApp(page);
      await expectResultsLoaded(page);

      const emptyRect = await mapPaneRect(page);
      await pageFillsViewport(page);

      const bar = page.locator(".filter-bar");

      // apply a filter
      await bar.getByRole("button", { name: "Ward 1", exact: true }).click();
      await expect(page.getByText("Ward: Ward 1")).toBeVisible();
      expect(await mapPaneRect(page)).toEqual(emptyRect);

      // change the filter (accumulate another ward value)
      await bar.getByRole("button", { name: "Ward 5", exact: true }).click();
      await expect(page.getByText("Ward: Ward 5")).toBeVisible();
      expect(await mapPaneRect(page)).toEqual(emptyRect);

      // remove one chip's value
      await page.getByRole("button", { name: 'Remove "Ward: Ward 1"' }).click();
      await expect(page.getByText("Ward: Ward 1")).toHaveCount(0);
      expect(await mapPaneRect(page)).toEqual(emptyRect);

      // clear everything that is left
      await bar.getByRole("button", { name: "Clear all filters" }).click();
      await expect(page.getByText("Ward: Ward 5")).toHaveCount(0);
      expect(await mapPaneRect(page)).toEqual(emptyRect);
      await pageFillsViewport(page);
    });

    test("the summary band keeps one height across the empty, active, and cleared states", async ({
      page,
    }) => {
      await openApp(page);
      await expectResultsLoaded(page);

      await expect(page.getByRole("heading", { name: "Selected filters (0)" })).toBeVisible();
      const emptyHeight = await summaryBandHeight(page);
      // The reserved band pins to its 76px budget (74–78px tolerance).
      expect(emptyHeight).toBeGreaterThanOrEqual(74);
      expect(emptyHeight).toBeLessThanOrEqual(78);

      const bar = page.locator(".filter-bar");
      await bar.getByRole("button", { name: "Ward 1", exact: true }).click();
      await bar.getByRole("button", { name: "Ward 5", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Selected filters (2)" })).toBeVisible();
      const activeHeight = await summaryBandHeight(page);

      await bar.getByRole("button", { name: "Clear all filters" }).click();
      await expect(page.getByRole("heading", { name: "Selected filters (0)" })).toBeVisible();
      const clearedHeight = await summaryBandHeight(page);

      expect(activeHeight).toBe(emptyHeight);
      expect(clearedHeight).toBe(emptyHeight);
    });
  });
}

test.describe("summary band overflow disclosure", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  const popover = (page: Page) => page.getByRole("group", { name: "More selected filters" });
  const trigger = (page: Page) =>
    page.locator(".filter-bar").getByRole("button", { name: /\+\d+ more/ });
  const removalsIn = (scope: ReturnType<Page["getByRole"]>) =>
    scope.getByRole("button", { name: /^Remove "/ });

  /** A selection set far wider than the 1280px chip row: 11 applied values. */
  async function applyOverflowingSelection(page: Page): Promise<void> {
    const bar = page.locator(".filter-bar");
    for (const ward of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      await bar.getByRole("button", { name: `Ward ${ward}`, exact: true }).click();
    }
    await bar.getByLabel("Housing type").selectOption("emergency-shelter");
    await bar
      .locator("fieldset", { hasText: "Referral required" })
      .getByRole("button", { name: "Yes" })
      .click();
    await bar
      .locator("fieldset", { hasText: "Sobriety required" })
      .getByRole("button", { name: "Yes" })
      .click();
    await expect(page.getByRole("heading", { name: "Selected filters (11)" })).toBeVisible();
  }

  test("with more selections than the row shows the overflow trigger appears and the popover lists every applied chip without moving the map pane", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    await applyOverflowingSelection(page);

    const rectBefore = await mapPaneRect(page);
    await expect(trigger(page)).toBeVisible();

    await trigger(page).click();
    await expect(popover(page)).toBeVisible();
    await expect(removalsIn(popover(page))).toHaveCount(11);
    // The disclosure is absolutely positioned: opening it displaces nothing.
    expect(await mapPaneRect(page)).toEqual(rectBefore);

    await page.getByRole("heading", { name: "Selected filters (11)" }).click();
    await expect(popover(page)).not.toBeVisible();
  });

  test("removing a value inside the popover unpresses its control and re-applying the value resurfaces its chip", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    await applyOverflowingSelection(page);
    const rectBefore = await mapPaneRect(page);

    await trigger(page).click();
    await expect(popover(page)).toBeVisible();

    await popover(page).getByRole("button", { name: 'Remove "Ward: Ward 8"' }).click();

    // The schema control unpresses and the chip disappears everywhere.
    await expect(
      page
        .locator(".filter-bar")
        .getByRole("button", { name: "Ward 8", exact: true })
        .and(page.locator('[aria-pressed="false"]')),
    ).toBeVisible();
    await expect(page.getByText("Ward: Ward 8")).toHaveCount(0);
    await expect(removalsIn(popover(page))).toHaveCount(10);
    // The disclosure is still needed for the ten remaining chips.
    await expect(trigger(page)).toBeVisible();
    expect(await mapPaneRect(page)).toEqual(rectBefore);

    // Re-applying from the control light-dismisses the popover.
    await page.locator(".filter-bar").getByRole("button", { name: "Ward 8", exact: true }).click();
    await expect(popover(page)).not.toBeVisible();

    // The chip resurfaces: in the row when it fits, in the popover when not.
    await trigger(page).click();
    await expect(popover(page).getByText("Ward: Ward 8")).toBeVisible();
    expect(await mapPaneRect(page)).toEqual(rectBefore);
  });

  test("the keyboard path opens the popover, removes a value, and Escape returns focus to the trigger with the map pane unmoved", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    await applyOverflowingSelection(page);
    const rectBefore = await mapPaneRect(page);

    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(popover(page)).toBeVisible();
    // Opening moves focus in, onto the first chip's removal control.
    const openFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    expect(openFocus).toBe('Remove "Ward: Ward 1"');

    // Tab works through the popover's removals.
    await page.keyboard.press("Tab");
    const tabbedFocus = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    );
    expect(tabbedFocus).toBe('Remove "Ward: Ward 2"');

    await page.keyboard.press("Enter");
    // Focus lands on the removal that took the removed chip's place, never
    // the page body. The removal's apply flows through the store's async
    // refresh, so poll for the settled focus rather than racing it.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""))
      .toBe('Remove "Ward: Ward 3"');
    await expect(removalsIn(popover(page))).toHaveCount(10);

    await page.keyboard.press("Escape");
    await expect(popover(page)).not.toBeVisible();
    await expect(trigger(page)).toBeFocused();
    expect(await mapPaneRect(page)).toEqual(rectBefore);
  });
});
