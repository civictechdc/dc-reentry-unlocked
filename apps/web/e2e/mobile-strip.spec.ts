import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./steps/app.steps.ts";

/**
 * Phone-width summary-strip probes (390×844): the strip holds one fixed
 * height, so applying, changing, removing, and clearing filters never moves
 * the centered map square. The strip's clear-all works on both tabs with the
 * sheet closed, count-chip activation opens the sheet without touching the
 * selection, and a `+N more` chip discloses content beyond the visible
 * strip width.
 */
test.use({ viewport: { width: 390, height: 844 } });

const strip = (page: Page) => page.locator(".summary-row");

async function stripHeight(page: Page): Promise<number> {
  return strip(page).evaluate((element) => element.getBoundingClientRect().height);
}

async function mapSquareRect(page: Page): Promise<Record<string, number>> {
  return page.getByTestId("map-view").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
    };
  });
}

/** Applies one ward value through the sheet (open, toggle, apply, close). */
async function applyThroughSheet(page: Page, ward: string): Promise<void> {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const sheet = page.getByTestId("filter-sheet");
  await sheet.getByRole("button", { name: ward, exact: true }).click();
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(sheet).not.toBeVisible();
}

test.describe("mobile summary strip", () => {
  test("the strip keeps one height and the map square one position across apply, change, remove, and clear", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();
    await page.waitForTimeout(300);

    const emptyHeight = await stripHeight(page);
    const emptyRect = await mapSquareRect(page);

    await applyThroughSheet(page, "Ward 1");
    await expect(page.getByRole("button", { name: "Ward (1 selected)" })).toBeVisible();
    expect(await stripHeight(page)).toBe(emptyHeight);
    expect(await mapSquareRect(page)).toEqual(emptyRect);

    // change: accumulate a second ward value
    await applyThroughSheet(page, "Ward 5");
    await expect(page.getByRole("button", { name: "Ward (2 selected)" })).toBeVisible();
    expect(await stripHeight(page)).toBe(emptyHeight);
    expect(await mapSquareRect(page)).toEqual(emptyRect);

    // remove one value: toggling Ward 1 off through the sheet
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const sheet = page.getByTestId("filter-sheet");
    await sheet.getByRole("button", { name: "Ward 1", exact: true }).click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Ward (1 selected)" })).toBeVisible();
    expect(await stripHeight(page)).toBe(emptyHeight);
    expect(await mapSquareRect(page)).toEqual(emptyRect);

    // clear everything from the strip itself
    await strip(page).getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.getByRole("button", { name: /Ward \(/ })).toHaveCount(0);
    expect(await stripHeight(page)).toBe(emptyHeight);
    expect(await mapSquareRect(page)).toEqual(emptyRect);
  });

  test("the strip's clear-all empties the selection on both tabs with the sheet closed", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();

    await applyThroughSheet(page, "Ward 1");
    await expect(page.getByRole("button", { name: "Ward (1 selected)" })).toBeVisible();

    await strip(page).getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.getByRole("button", { name: /Ward \(/ })).toHaveCount(0);
    // The unmounting button hands focus to the strip, not the page body
    // (the handoff completes with the store's async clear).
    await expect
      .poll(() => page.evaluate(() => document.activeElement !== document.body))
      .toBe(true);

    // Same control on the list tab.
    await applyThroughSheet(page, "Ward 1");
    await page.getByRole("tab", { name: "List" }).click();
    await expect(page.locator(".unit-list article").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ward (1 selected)" })).toBeVisible();

    await strip(page).getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.getByRole("button", { name: /Ward \(/ })).toHaveCount(0);
  });

  test("tapping a count chip opens the sheet and the selection survives the round trip", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();

    await applyThroughSheet(page, "Ward 1");
    await applyThroughSheet(page, "Ward 5");
    await applyThroughSheet(page, "Ward 3");
    await expect(page.getByRole("button", { name: "Ward (3 selected)" })).toBeVisible();

    await page.getByRole("button", { name: "Ward (3 selected)" }).click();
    const sheet = page.getByTestId("filter-sheet");
    await expect(sheet).toBeVisible();

    // The sheet shows all three values still pressed — activation removed
    // nothing.
    for (const ward of ["Ward 1", "Ward 5", "Ward 3"]) {
      await expect(
        sheet
          .getByRole("button", { name: ward, exact: true })
          .and(page.locator('[aria-pressed="true"]')),
      ).toBeVisible();
    }

    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Ward (3 selected)" })).toBeVisible();

    // Closing hands focus back to the count chip that opened the sheet.
    await expect
      .poll(() => page.evaluate(() => document.activeElement !== document.body))
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute("data-count-filter") ?? ""),
      )
      .toBe("ward");
  });

  test("six filters overflow the strip: the +N more chip appears, the scroll fade shows, and the chip opens the sheet", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const sheet = page.getByTestId("filter-sheet");
    await sheet.locator("#filter-housing-type").selectOption("emergency-shelter");
    await sheet.locator("#filter-length-of-stay").selectOption("short-term-up-to-90-days");
    await sheet.locator("#filter-population").selectOption("individuals");
    await sheet.locator("#filter-gender").selectOption("women");
    await sheet.getByRole("button", { name: "Ward 1", exact: true }).click();
    await sheet
      .locator("fieldset", { hasText: "Referral required" })
      .getByRole("button", { name: "Yes" })
      .click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();

    // Six count chips run past the 390px strip: disclosure and fade appear.
    const more = strip(page).getByRole("button", { name: /\+\d+ more/ });
    await expect(more).toBeVisible();
    await expect(strip(page).locator(".strip-fade")).toBeVisible();

    // Exact disclosure count: chips fully inside the scrollport + N == six,
    // and the trigger sits inside the visible strip width (the partition
    // anchors at the list's left padding).
    const { visibleCount, triggerInside } = await page.evaluate(() => {
      const scroll = document.querySelector(".strip-scroll");
      const list = scroll?.querySelector("ul");
      const trigger = list?.querySelector("li.more-trigger button");
      if (!scroll || !list || !trigger) return { visibleCount: -1, triggerInside: false };
      const limit = scroll.getBoundingClientRect().right;
      const chips = [...list.querySelectorAll("li.count-chip:not(.more-trigger)")];
      const visible = chips.filter(
        (chip) => chip.getBoundingClientRect().right <= limit + 0.5,
      ).length;
      const triggerRect = trigger.getBoundingClientRect();
      return {
        visibleCount: visible,
        triggerInside: triggerRect.right <= scroll.getBoundingClientRect().right + 0.5,
      };
    });
    const hiddenCount = 6 - visibleCount;
    expect(hiddenCount).toBeGreaterThanOrEqual(1);
    await expect(more).toHaveText(`+${hiddenCount} more`);
    expect(triggerInside).toBe(true);

    // All six selections remain reachable inside the opened sheet.
    await more.click();
    await expect(page.getByTestId("filter-sheet")).toBeVisible();
    await expect(sheet.locator("#filter-housing-type")).toHaveValue("emergency-shelter");
    await expect(sheet.locator("#filter-length-of-stay")).toHaveValue("short-term-up-to-90-days");
    await expect(sheet.locator("#filter-population")).toHaveValue("individuals");
    await expect(sheet.locator("#filter-gender")).toHaveValue("women");
    await expect(
      sheet
        .getByRole("button", { name: "Ward 1", exact: true })
        .and(page.locator('[aria-pressed="true"]')),
    ).toBeVisible();
    await expect(
      sheet
        .locator("fieldset", { hasText: "Referral required" })
        .getByRole("button", { name: "Yes" })
        .and(page.locator('[aria-pressed="true"]')),
    ).toBeVisible();

    // Closing the sheet keeps every selection intact.
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Ward (1 selected)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Housing type (1 selected)" })).toBeVisible();
  });

  test("count chips that fit show no disclosure and no scroll fade", async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();

    await applyThroughSheet(page, "Ward 1");
    await expect(page.getByRole("button", { name: "Ward (1 selected)" })).toBeVisible();

    await expect(strip(page).getByRole("button", { name: /\+\d+ more/ })).toHaveCount(0);
    await expect(strip(page).locator(".strip-fade")).toHaveCount(0);
  });

  test("keyboard focus reveals the last count chip inside the scrolling strip", async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();

    // The six-filter selection genuinely overflows the strip.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const sheet = page.getByTestId("filter-sheet");
    await sheet.locator("#filter-housing-type").selectOption("emergency-shelter");
    await sheet.locator("#filter-length-of-stay").selectOption("short-term-up-to-90-days");
    await sheet.locator("#filter-population").selectOption("individuals");
    await sheet.locator("#filter-gender").selectOption("women");
    await sheet.getByRole("button", { name: "Ward 1", exact: true }).click();
    await sheet
      .locator("fieldset", { hasText: "Referral required" })
      .getByRole("button", { name: "Yes" })
      .click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await expect(sheet).not.toBeVisible();

    const more = strip(page).getByRole("button", { name: /\+\d+ more/ });
    await expect(more).toBeVisible();

    // The target starts clipped: the strip is at scrollLeft 0 and the last
    // count chip's right edge lies beyond the scrollport's right edge.
    const startsClipped = await page.evaluate(() => {
      const scroll = document.querySelector(".strip-scroll");
      const chips = [...(scroll?.querySelectorAll("li.count-chip") ?? [])];
      const last = chips[chips.length - 1];
      if (!scroll || !last) return null;
      const sr = scroll.getBoundingClientRect();
      const lr = last.getBoundingClientRect();
      return {
        scrollLeft: scroll.scrollLeft,
        lastRight: Math.round(lr.right),
        scrollRight: Math.round(sr.right),
        clipped: lr.right > sr.right,
      };
    });
    expect(startsClipped).not.toBeNull();
    expect(startsClipped?.scrollLeft).toBe(0);
    expect(startsClipped?.clipped, "the last count chip starts clipped").toBe(true);

    // Reach it with real Tab presses from the first count chip: the browser
    // scroll-reveals the focused chip inside the scrollport.
    await strip(page)
      .getByRole("button", { name: /\(1 selected\)/ })
      .first()
      .focus();
    // Tab through the strip's focusables (data chips AND the disclosure
    // trigger interleave) until the last count chip's removal control holds
    // focus (the li wrapper wraps it, the button receives the focus).
    const lastChipButton = strip(page).locator("li.count-chip button").last();
    for (let step = 0; step < 12; step += 1) {
      const onLast = await lastChipButton.evaluate((el) => document.activeElement === el);
      if (onLast) break;
      await page.keyboard.press("Tab");
    }
    await expect(lastChipButton).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scroll = document.querySelector(".strip-scroll");
          const chips = [...(scroll?.querySelectorAll("li.count-chip") ?? [])];
          const last = chips[chips.length - 1];
          if (!scroll || !last) return null;
          const fr = last.getBoundingClientRect();
          const sr = scroll.getBoundingClientRect();
          return fr.left >= sr.left && fr.right <= sr.right;
        }),
      )
      .toBe(true);
  });
});
