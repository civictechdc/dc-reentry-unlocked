import { expect, test, type Page } from "@playwright/test";

/**
 * Desktop proportions, pinned to the scenario's platform-independent
 * invariants — the example dimensions in the scenario ("for example
 * roughly …") are illustrations, not cross-platform constants, because
 * the filter controls wrap differently under other platforms' font
 * metrics. The invariants: the map view caps at 3:2 inside its pane and
 * fills it; the filter controls sit above a reserved compact summary
 * band (~76px) and the map row takes exactly the height left under them
 * (derived from the grid's own gap and padding, never absolute totals);
 * the capped map leaves at most a 15% dead margin on each side; the card
 * list's unscrolled window shows at least three units — the precise
 * count is font-dependent (macOS shows 5/4, CI Linux showed 4 — control
 * wrap and card heights follow the platform font), so only the floor is
 * pinned; and no selection changes any measured rect or scrolls the
 * whole page. At the short 1440×660 desktop the map pane clamps inside
 * its grid row instead of overflowing the page.
 */

interface Proportions {
  bandHeight: number;
  mapView: { width: number; height: number };
  mapViewAspect: number;
  mapPane: { top: number; bottom: number; width: number; height: number };
  filterPaneBottom: number;
  layoutRowGap: number;
  layoutContentBottom: number;
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
    const filterPane = rect(".filter-pane");
    const layout = document.querySelector(".desktop-layout");
    const layoutStyle = layout ? getComputedStyle(layout) : null;
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
        top: pane?.top ?? 0,
        bottom: pane?.bottom ?? 0,
        width: pane?.width ?? 0,
        height: pane?.height ?? 0,
      },
      filterPaneBottom: filterPane?.bottom ?? 0,
      layoutRowGap: layoutStyle ? parseFloat(layoutStyle.rowGap) : 0,
      layoutContentBottom:
        layout && layoutStyle
          ? layout.getBoundingClientRect().bottom - parseFloat(layoutStyle.paddingBottom)
          : 0,
      sideDeadMarginEach: pane && view ? (pane.width - view.width) / 2 : 0,
      cardsFullyVisible: fullyVisible,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
    };
  });
}

async function applyWardSelection(page: Page, unfilteredCountLine: string | null): Promise<void> {
  const bar = page.locator(".filter-bar");
  await bar.getByRole("button", { name: "Ward 1", exact: true }).click();
  await page.getByText("Ward: Ward 1").waitFor({ timeout: 20_000 });
  await bar.getByRole("button", { name: "Ward 5", exact: true }).click();
  await page.getByText("Ward: Ward 5").waitFor({ timeout: 20_000 });
  // Gate on the refresh landing (the visible count line shows the filtered
  // count) so the comparison measures the settled filtered layout.
  await expect(page.locator(".result-count")).not.toHaveText(unfilteredCountLine ?? "");
}

const VIEWPORTS = {
  "1920x1080": { width: 1920, height: 1080 },
  "1440x900": { width: 1440, height: 900 },
} as const;

for (const [viewport, size] of Object.entries(VIEWPORTS) as [
  keyof typeof VIEWPORTS,
  (typeof VIEWPORTS)["1920x1080"],
][]) {
  test.describe(`desktop proportions at ${viewport}`, () => {
    test.use({ viewport: size });

    test("the 3:2-capped map fills the row left under the controls and band, the band absorbs selection changes, and nothing scrolls the page", async ({
      page,
    }) => {
      await page.goto("/");
      await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
      await page.locator(".unit-list article").first().waitFor({ timeout: 20_000 });

      const unfiltered = await measureProportions(page);
      const unfilteredCountLine = await page.locator(".result-count").textContent();

      // 3:2 cap and fill: the map view fills its pane's height and takes
      // exactly min(pane width, pane height × 1.5) — relational to the
      // pane, never an absolute pixel total.
      expect(Math.abs(unfiltered.mapViewAspect - 1.5)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(unfiltered.mapView.height - unfiltered.mapPane.height)).toBeLessThanOrEqual(
        1,
      );
      const cappedWidth = Math.min(unfiltered.mapPane.width, unfiltered.mapPane.height * 1.5);
      expect(Math.abs(unfiltered.mapView.width - cappedWidth)).toBeLessThanOrEqual(1);

      // Reserved band: fixed compact height, identical either way.
      expect(unfiltered.bandHeight).toBeGreaterThanOrEqual(74);
      expect(unfiltered.bandHeight).toBeLessThanOrEqual(78);

      // Layout arithmetic: the map row starts one grid gap under the
      // controls (the gap comes from the layout's own computed style) and
      // its bottom is exactly the layout's content-box bottom — the row
      // gets precisely the height left after the controls and the band.
      expect(
        Math.abs(unfiltered.mapPane.top - (unfiltered.filterPaneBottom + unfiltered.layoutRowGap)),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(unfiltered.mapPane.bottom - unfiltered.layoutContentBottom),
      ).toBeLessThanOrEqual(1);

      // Side dead margin: at most 15% of the map pane width on each side.
      expect(unfiltered.sideDeadMarginEach).toBeLessThanOrEqual(unfiltered.mapPane.width * 0.15);

      // Card window: the precise count is font-dependent (macOS shows 5
      // here, CI Linux showed 4 — card heights and the controls' wrap
      // follow the platform font), so only the cross-platform floor of
      // three fully visible units is pinned.
      expect(unfiltered.cardsFullyVisible).toBeGreaterThanOrEqual(3);

      // No whole-page scroll.
      expect(unfiltered.pageScrolls).toBe(false);

      // With a selection applied: every measured rect is exactly identical
      // — the reserved band absorbs selection changes alone.
      await applyWardSelection(page, unfilteredCountLine);
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

    const short = await measureProportions(page);
    expect(short.pageScrolls).toBe(false);
    expect(short.mapPane.bottom).toBeLessThanOrEqual(short.layoutContentBottom);
    expect(Math.abs(short.mapViewAspect - 1.5)).toBeLessThanOrEqual(0.02);
  });
});
