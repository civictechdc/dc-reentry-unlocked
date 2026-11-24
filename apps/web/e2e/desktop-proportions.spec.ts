import { expect, test, type Page } from "@playwright/test";

/**
 * Desktop proportions, pinned to the corrected scenario's measured figures:
 * the reserved summary band holds 76px, the map view caps near 3:2 with the
 * measured sizes at the two reference desktops, roughly four to five cards
 * fill the list's unscrolled window, the capped map leaves at most a 15%
 * dead margin on each side, and no selection ever scrolls the whole page or
 * changes any of it. At the short 1440×660 desktop the map pane clamps
 * inside its grid row instead of overflowing the page.
 */

interface Proportions {
  bandHeight: number;
  mapView: { width: number; height: number };
  mapViewAspect: number;
  mapPane: { width: number; height: number; bottom: number };
  layoutBottom: number;
  sideDeadMarginEach: number;
  cardsFullyVisible: number;
  pageScrolls: boolean;
}

async function measureProportions(page: Page): Promise<Proportions> {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? el.getBoundingClientRect() : null;
    };
    const view = rect(".map-view");
    const pane = rect(".map-pane");
    const layout = rect(".desktop-layout");
    const list = rect(".unit-list");
    const band = rect(".summary-band");
    const cards = [...document.querySelectorAll(".unit-list article")];
    const fullyVisible = cards.filter((card) => {
      const r = card.getBoundingClientRect();
      return list && r.top >= list.top && r.bottom <= list.bottom;
    }).length;
    return {
      bandHeight: band?.height ?? 0,
      mapView: { width: view?.width ?? 0, height: view?.height ?? 0 },
      mapViewAspect: view ? view.width / view.height : 0,
      mapPane: {
        width: pane?.width ?? 0,
        height: pane?.height ?? 0,
        bottom: pane?.bottom ?? 0,
      },
      layoutBottom: layout?.bottom ?? 0,
      sideDeadMarginEach: pane && view ? (pane.width - view.width) / 2 : 0,
      cardsFullyVisible: fullyVisible,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
    };
  });
}

async function applyWardSelection(page: Page): Promise<void> {
  const bar = page.locator(".filter-bar");
  await bar.getByRole("button", { name: "Ward 1", exact: true }).click();
  await page.getByText("Ward: Ward 1").waitFor({ timeout: 20_000 });
  await bar.getByRole("button", { name: "Ward 5", exact: true }).click();
  await page.getByText("Ward: Ward 5").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(300);
}

const EXPECTED = {
  "1920x1080": {
    viewport: { width: 1920, height: 1080 },
    mapView: { width: 1104, height: 736 },
    cardsFullyVisible: 5,
  },
  "1440x900": {
    viewport: { width: 1440, height: 900 },
    mapView: { width: 862, height: 574 },
    cardsFullyVisible: 4,
  },
} as const;

for (const [viewport, expected] of Object.entries(EXPECTED) as [
  "1920x1080" | "1440x900",
  (typeof EXPECTED)["1920x1080"],
][]) {
  test.describe(`desktop proportions at ${viewport}`, () => {
    test.use({ viewport: { width: expected.viewport.width, height: expected.viewport.height } });

    test("band height, capped map size, card window, dead margins, and page fill match the measured figures with and without a selection", async ({
      page,
    }) => {
      await page.goto("/");
      await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
      await page.locator(".unit-list article").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(300);

      const unfiltered = await measureProportions(page);

      // Band: 76px reserved, both states identical.
      expect(unfiltered.bandHeight).toBeGreaterThanOrEqual(74);
      expect(unfiltered.bandHeight).toBeLessThanOrEqual(78);

      // Map view caps near 3:2 at the measured size (±3px).
      expect(Math.abs(unfiltered.mapViewAspect - 1.5)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(unfiltered.mapView.width - expected.mapView.width)).toBeLessThanOrEqual(3);
      expect(Math.abs(unfiltered.mapView.height - expected.mapView.height)).toBeLessThanOrEqual(3);

      // Side dead margin: at most 15% of the map pane width on each side.
      expect(unfiltered.sideDeadMarginEach).toBeLessThanOrEqual(unfiltered.mapPane.width * 0.15);

      // Card window: the measured figure (±1) fits fully.
      expect(unfiltered.cardsFullyVisible).toBeGreaterThanOrEqual(expected.cardsFullyVisible - 1);
      expect(unfiltered.cardsFullyVisible).toBeLessThanOrEqual(expected.cardsFullyVisible + 1);

      // No whole-page scroll.
      expect(unfiltered.pageScrolls).toBe(false);

      // With a selection applied: every figure is identical.
      await applyWardSelection(page);
      const filtered = await measureProportions(page);
      expect(filtered).toEqual(unfiltered);
    });
  });
}

test.describe("desktop proportions at 1440x660 (short desktop)", () => {
  test.use({ viewport: { width: 1440, height: 660 } });

  test("the page does not scroll and the map pane clamps inside its grid row at the 3:2 cap", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
    await page.locator(".unit-list article").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(300);

    const short = await measureProportions(page);
    expect(short.pageScrolls).toBe(false);
    expect(short.mapPane.bottom).toBeLessThanOrEqual(short.layoutBottom);
    expect(Math.abs(short.mapViewAspect - 1.5)).toBeLessThanOrEqual(0.02);
  });
});
