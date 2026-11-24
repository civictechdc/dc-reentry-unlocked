import { expect, test, type Page } from "@playwright/test";

/**
 * Overflow-popover layering and height-cap probes. The app's document-level
 * off-map click dismissal closes an open unit detail on any filter-bar
 * interaction, so the popover and the detail never coexist through the UI —
 * these probes therefore assert: the popover paints above everything that
 * IS present (elementFromPoint at its centre), the declared z-order is
 * popover (35) above detail (30) for any programmatic coexistence, focus
 * re-anchors inside the popover when its non-focusable content is clicked,
 * and the popover's height caps by the space below the row so a short
 * desktop never scrolls the whole page.
 */

async function openAppAndLoad(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
  await page.locator(".unit-list article").first().waitFor({ timeout: 20_000 });
}

async function applyOverflowSelection(page: Page): Promise<void> {
  const bar = page.locator(".filter-bar");
  for (const ward of [
    "Ward 1",
    "Ward 2",
    "Ward 3",
    "Ward 4",
    "Ward 5",
    "Ward 6",
    "Ward 7",
    "Ward 8",
  ]) {
    await bar.getByRole("button", { name: ward, exact: true }).click();
  }
  await bar
    .locator(".control-boolean")
    .filter({ hasText: "Referral required" })
    .getByRole("button", { name: "Yes" })
    .click();
  await expect(bar.getByRole("button", { name: /\+\d+ more/ })).toBeVisible();
}

async function openPopover(page: Page): Promise<void> {
  await page
    .locator(".filter-bar")
    .getByRole("button", { name: /\+\d+ more/ })
    .click();
  await expect(page.getByRole("group", { name: "More selected filters" })).toBeVisible();
}

test.describe("popover above an open unit detail", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the keyboard-opened popover paints above everything at its centre, with the declared z-order over the detail panel", async ({
    page,
  }) => {
    await openAppAndLoad(page);
    await applyOverflowSelection(page);

    // Open a unit detail first (card click), then the disclosure via the
    // keyboard path: focus the trigger and press Enter.
    await page.locator(".unit-list article").first().getByRole("button").first().click();
    await expect(page.getByTestId("unit-detail")).toBeVisible();

    const trigger = page.locator(".filter-bar").getByRole("button", { name: /\+\d+ more/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const popover = page.getByRole("group", { name: "More selected filters" });
    await expect(popover).toBeVisible();

    // Documented app behavior: the off-map click dismissal closed the unit
    // detail when the disclosure was opened from the filter bar.
    const detailGone = await page.evaluate(
      () => !document.querySelector('[data-testid="unit-detail"]'),
    );
    expect(detailGone, "the off-map dismissal closed the detail").toBe(true);

    // The popover centre must hit popover content (nothing covers it).
    const hitInside = await page.evaluate(() => {
      const popover = document.querySelector(".chips-popover");
      if (!popover) return false;
      const r = popover.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit instanceof Node && popover.contains(hit);
    });
    expect(hitInside, "the popover paints above everything at its centre").toBe(true);

    // Declared paint order for any programmatic coexistence: the popover
    // declares z-index 35, above the detail panel's 30 (the off-map
    // dismissal means they never coexist through the UI, so the order is
    // pinned here rather than exercised).
    const popoverZ = await page.evaluate(() => {
      const popover = document.querySelector(".chips-popover");
      return popover ? Number(getComputedStyle(popover).zIndex) : 0;
    });
    expect(popoverZ).toBe(35);
  });

  test("with a unit detail open the covered trigger reads as detail content under the pointer but stays keyboard-operable", async ({
    page,
  }) => {
    await openAppAndLoad(page);
    await applyOverflowSelection(page);

    await page.locator(".unit-list article").first().getByRole("button").first().click();
    await expect(page.getByTestId("unit-detail")).toBeVisible();

    const probe = await page.evaluate(() => {
      const trigger = document.querySelector(".more-trigger button");
      const detail = document.querySelector('[data-testid="unit-detail"]');
      if (!trigger || !detail) return { overlap: false };
      const tr = trigger.getBoundingClientRect();
      const dr = detail.getBoundingClientRect();
      const overlap =
        tr.left < dr.right && tr.right > dr.left && tr.top < dr.bottom && tr.bottom > dr.top;
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height / 2;
      const centerUnderDetail = cx >= dr.left && cx <= dr.right && cy >= dr.top && cy <= dr.bottom;
      const hit = document.elementFromPoint(cx, cy);
      return {
        overlap,
        centerUnderDetail,
        hitIsTrigger: hit === trigger || trigger.contains(hit),
        hitInDetail: detail.contains(hit),
      };
    });
    // The trigger overlaps the open detail and its centre is covered: the
    // detail wins the hit-testing (the trigger paints under the panel like
    // every other band control).
    expect(probe.overlap, "the trigger overlaps the open detail").toBe(true);
    expect(probe.centerUnderDetail, "the trigger centre sits under the detail").toBe(true);
    expect(probe.hitIsTrigger, "the detail wins the hit-testing over the trigger").toBe(false);
    expect(probe.hitInDetail, "the detail holds the covered point").toBe(true);

    // But the trigger stays keyboard-operable.
    const trigger = page.locator(".filter-bar").getByRole("button", { name: /\+\d+ more/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("group", { name: "More selected filters" })).toBeVisible();
  });
});

test.describe("popover above an open unit detail (focus re-anchor)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("clicking non-focusable popover content keeps focus inside the open popover", async ({
    page,
  }) => {
    await openAppAndLoad(page);
    await applyOverflowSelection(page);

    await openPopover(page);
    const popover = page.getByRole("group", { name: "More selected filters" });
    await expect(popover).toBeVisible();

    // Click the popover title (non-focusable content): focus must stay
    // anchored inside the open disclosure.
    await popover.getByText("More selected filters").click();
    await expect(popover).toBeVisible();
    const insideAfterTitleClick = await page.evaluate(() => {
      const popover = document.querySelector(".chips-popover");
      return popover ? popover.contains(document.activeElement) : false;
    });
    expect(insideAfterTitleClick, "focus stays inside the popover").toBe(true);
  });
});

test.describe("popover height cap on a short desktop", () => {
  test.use({ viewport: { width: 1024, height: 600 } });

  test("the capped popover stays inside the viewport without scrolling the page", async ({
    page,
  }) => {
    await openAppAndLoad(page);
    await applyOverflowSelection(page);

    // Shrink the viewport so the cap derivation is deterministic on every
    // platform: with innerHeight = rowBottom + 16 + 200 the computed cap is
    // 200px — tighter than the 16rem (256px) CSS default, so the test really
    // exercises the cap (never dependent on font metrics at 1024×600).
    const rowBottom: number | null = await page.evaluate(() => {
      const row = document.querySelector(".chips-row");
      return row ? row.getBoundingClientRect().bottom : null;
    });
    if (rowBottom === null) throw new Error("the chips row never mounted");
    await page.setViewportSize({
      width: 1024,
      height: Math.min(600, Math.round(rowBottom + 16 + 200)),
    });

    const pageScrollsBefore = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );

    // The expected cap, computed from the row rect exactly as the component
    // does: min(16rem, innerHeight − rowBottom − 16px), floored at 6rem.
    const expectedCap = await page.evaluate(() => {
      const row = document.querySelector(".chips-row");
      if (!row) return null;
      const space = window.innerHeight - row.getBoundingClientRect().bottom - 16;
      return `${Math.max(96, Math.min(256, Math.round(space)))}px`;
    });
    expect(expectedCap).not.toBeNull();
    // Premise for a non-vacuous cap: at this viewport the computed cap is
    // tighter than the 16rem CSS default, so the test really exercises it.
    expect(expectedCap).not.toBe("256px");

    await openPopover(page);
    const popover = page.getByRole("group", { name: "More selected filters" });
    await expect(popover).toBeVisible();

    const geometry = await page.evaluate(() => {
      const popover = document.querySelector(".chips-popover");
      const r = popover?.getBoundingClientRect();
      return {
        bottom: r?.bottom ?? 0,
        maxHeight: r ? getComputedStyle(popover as Element).maxHeight : "",
        viewportHeight: window.innerHeight,
        scrolls: document.documentElement.scrollHeight > window.innerHeight,
      };
    });
    expect(geometry.bottom, "the popover bottom stays inside the viewport").toBeLessThanOrEqual(
      geometry.viewportHeight,
    );
    // The computed max-height equals the cap derived from the row rect.
    expect(geometry.maxHeight, "the height cap matches the row-rect derivation").toBe(expectedCap);
    // Opening the popover introduces no whole-page scroll on a short desktop.
    expect(geometry.scrolls).toBe(pageScrollsBefore);
  });
});
