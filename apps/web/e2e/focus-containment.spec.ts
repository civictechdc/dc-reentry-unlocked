import { expect, test, type Page } from "@playwright/test";

/**
 * Focus-ring containment probes: the bounded desktop chip row and the phone
 * summary strip must not clip the shared 3px/2px-offset focus ring of the
 * controls they scroll or bound — the row must not clip vertically at all,
 * the strip must reserve enough block padding, and the ring must stay
 * inside the band / strip visual boundary when a control is focused.
 */

async function openAppAndLoad(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
  // Phone boots on the map tab (no card list); desktop shows both panes.
  await page
    .locator(".unit-list article")
    .first()
    .or(page.getByTestId("map-view"))
    .first()
    .waitFor({ timeout: 20_000 });
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
  await bar
    .locator(".control-boolean")
    .filter({ hasText: "Sobriety required" })
    .getByRole("button", { name: "Yes" })
    .click();
  await expect(bar.getByRole("button", { name: /\+\d+ more/ })).toBeVisible();
}

async function expectRingContained(page: Page, containerSelector: string): Promise<void> {
  const contained = await page.evaluate(
    ({ containerSelector, inflate }) => {
      const focused = document.activeElement;
      const container = document.querySelector(containerSelector);
      if (!focused || !container) return null;
      const fr = focused.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      return (
        fr.top - inflate >= cr.top &&
        fr.bottom + inflate <= cr.bottom &&
        fr.left - inflate >= cr.left &&
        fr.right + inflate <= cr.right
      );
    },
    { containerSelector, inflate: 5 },
  );
  expect(contained, "the focused control's ring stays inside its visual boundary").toBe(true);
}

test.describe("focus rings inside the bounded desktop chip row", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the overflow trigger and a chip removal keep their rings within the band", async ({
    page,
  }) => {
    await openAppAndLoad(page);
    await applyOverflowSelection(page);

    // The bounded row must not clip the ring vertically at all.
    const rowOverflowY = await page
      .locator(".chips-row")
      .evaluate((element) => getComputedStyle(element).overflowY);
    expect(rowOverflowY).toBe("visible");

    const trigger = page.locator(".filter-bar").getByRole("button", { name: /\+\d+ more/ });
    await trigger.focus();
    // The measurement below describes THIS control's ring — assert the
    // intended target actually holds focus before measuring.
    await expect(trigger).toBeFocused();
    // The trigger's horizontal distance to the band's right edge is only as
    // large as the partition's leftover slack (not font-guaranteed), so its
    // ring containment is asserted against the filter-bar section, whose
    // 12px horizontal padding is deterministic.
    await expectRingContained(page, ".filter-bar");

    // Any visible removal control: its ring must stay inside the band.
    // (Which chip is visible depends on font metrics, so target the first
    // removal control with a horizontal tolerance for the row boundary.)
    const removeButton = page
      .locator(".summary-band")
      .getByRole("button", { name: /^Remove "/ })
      .first();
    await removeButton.focus();
    // The ring measurement below describes THIS control — assert the
    // intended target actually holds focus before measuring.
    await expect(removeButton).toBeFocused();
    const removeRing = await page.evaluate(() => {
      const focused = document.activeElement;
      const band = document.querySelector(".summary-band");
      if (!focused || !band) return null;
      const fr = focused.getBoundingClientRect();
      const br = band.getBoundingClientRect();
      // Vertical containment is strict (the row no longer clips vertically);
      // horizontal containment allows the row's own boundary tolerance.
      return {
        vertical: fr.top - 5 >= br.top && fr.bottom + 5 <= br.bottom,
        horizontal: fr.left - 5 >= br.left && fr.right + 5 <= br.right + 5,
      };
    });
    expect(removeRing?.vertical, "removal ring vertical containment").toBe(true);
    expect(removeRing?.horizontal, "removal ring horizontal containment").toBe(true);
  });
});

test.describe("focus rings inside the phone summary strip", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a focused count chip keeps its ring inside the scrolling strip", async ({ page }) => {
    await openAppAndLoad(page);

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const sheet = page.getByTestId("filter-sheet");
    await sheet.getByRole("button", { name: "Ward 1", exact: true }).click();
    await sheet.getByRole("button", { name: "Apply filters" }).click();
    await sheet.waitFor({ state: "hidden" });

    const chip = page.getByRole("button", { name: "Ward (1 selected)" });
    await chip.focus();
    // The ring measurement below describes THIS chip — assert the intended
    // target actually holds focus before measuring.
    await expect(chip).toBeFocused();
    await expectRingContained(page, ".strip-scroll");
  });
});
