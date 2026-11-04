import { expect, test, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";
import { expectCameraFocusedOn, unitBehindFirstCard } from "./steps/map.steps.ts";

/**
 * The address label is painted by the `units-pins-label` symbol layer onto
 * the WebGL canvas — invisible to DOM queries. Every pixel proof compares a
 * label-ON screenshot of the map canvas against a label-OFF screenshot from
 * the SAME camera framing (hover/focus/selection removed; the camera never
 * moves in between), so the only canvas change is the label plus its sibling
 * highlight ring. Raster tiles are identical across the pair and therefore
 * contribute no diff pixels. The PNG buffers are decoded with the browser's
 * own canvas 2D API on a blank throwaway page — no image library added to
 * the repo and no dependence on the app page's strict CSP.
 */

/**
 * Change-detection bounds, mirroring the layer's paint constants: a
 * per-channel delta above 32 counts as a changed pixel; the dark-ink bound
 * (80 luminance) separates the label's explicit dark `text-color` from the
 * highlight ring's orange fill, whose luminance sits above it; the white
 * bound (230 per channel) is the halo's explicit white. The values live in
 * the in-page diff function below.
 */
/**
 * Changed-pixel count is a TRIPWIRE, not the label proof: a bare
 * label-less re-render that only toggles the highlight ring already clears
 * this threshold (ring area ≈ 380 px). The label discriminator is the
 * dark-ink assertion below — the label's ink is the only paint in the diff
 * set dark enough to fall under the luminance bound. Do not tune this count
 * up or down believing it proves the label.
 */
const MIN_CHANGED_PIXELS = 250;
/** Any legible glyph run carries at least this many dark ink pixels. */
const MIN_DARK_PIXELS = 25;
/** Glyph ink must touch changed white pixels — the halo legibility proof. */
const MIN_DARK_WITH_WHITE_NEIGHBOR = 10;

/**
 * The canvas repaints on requestAnimationFrame and glyph rasterization and
 * tile decode are not observable from the DOM; a bounded settle wait after
 * the camera attributes go still keeps both screenshots on the same fully
 * painted frame.
 */
const SETTLE_MS = 600;

type LabelDiffStats = {
  width: number;
  height: number;
  changed: number;
  darkInk: number;
  darkInkWithWhiteNeighbor: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

async function mapCanvas(page: Page) {
  const canvas = page.locator('[data-testid="map-view"] .map-canvas canvas');
  await expect(canvas).toBeVisible();
  return canvas;
}

/** Tiles fetched, camera still, glyphs rasterized: safe to screenshot. */
async function settleMap(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(SETTLE_MS);
}

async function canvasShot(page: Page): Promise<Buffer> {
  return await (await mapCanvas(page)).screenshot();
}

/**
 * Pixel-level diff of two label-ON/OFF canvas screenshots of the same
 * framing. The buffers are decoded on a blank throwaway page (no service
 * worker, no CSP, no data-URL image loader — bytes go in as an array) and
 * only the summary numbers cross back, never the pixel bulk.
 */
async function labelDiff(
  page: Page,
  withLabel: Buffer,
  withoutLabel: Buffer,
): Promise<LabelDiffStats> {
  const scratch = await page.context().newPage();
  try {
    return await scratch.evaluate(
      async ([withLabelData, withoutLabelData]) => {
        const decode = (base64: string): Promise<ImageData> =>
          new Promise((resolve, reject) => {
            const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
            createImageBitmap(new Blob([bytes], { type: "image/png" }))
              .then((bitmap) => {
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (!context) {
                  reject(new Error("2D canvas context unavailable for screenshot decode"));
                  return;
                }
                context.drawImage(bitmap, 0, 0);
                resolve(context.getImageData(0, 0, canvas.width, canvas.height));
              })
              .catch(() =>
                reject(new Error(`screenshot decode failed (payload ${bytes.length} bytes)`)),
              );
          });

        const on = await decode(withLabelData);
        const off = await decode(withoutLabelData);
        if (on.width !== off.width || on.height !== off.height) {
          throw new Error("label-ON/OFF screenshots differ in size");
        }

        // Indexed channel reads are asserted non-undefined: both images have
        // identical, verified dimensions, so every index below is in range.
        const channel = (data: Uint8ClampedArray, i: number): number => data[i]!;

        const changed = new Uint8Array(on.width * on.height);
        let changedCount = 0;
        let minX = on.width;
        let minY = on.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < on.height; y++) {
          for (let x = 0; x < on.width; x++) {
            const i = (y * on.width + x) * 4;
            const delta = Math.max(
              Math.abs(channel(on.data, i) - channel(off.data, i)),
              Math.abs(channel(on.data, i + 1) - channel(off.data, i + 1)),
              Math.abs(channel(on.data, i + 2) - channel(off.data, i + 2)),
            );
            if (delta > 32) {
              changed[y * on.width + x] = 1;
              changedCount += 1;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        const luminance = (data: Uint8ClampedArray, i: number): number =>
          0.299 * channel(data, i) + 0.587 * channel(data, i + 1) + 0.114 * channel(data, i + 2);
        const isWhite = (data: Uint8ClampedArray, i: number): boolean =>
          channel(data, i) >= 230 && channel(data, i + 1) >= 230 && channel(data, i + 2) >= 230;
        let darkInk = 0;
        let darkInkWithWhiteNeighbor = 0;
        for (let y = 0; y < on.height; y++) {
          for (let x = 0; x < on.width; x++) {
            if (!changed[y * on.width + x]) continue;
            const i = (y * on.width + x) * 4;
            if (luminance(on.data, i) >= 80) continue;
            darkInk += 1;
            let whiteNeighbor = false;
            for (let dy = -1; dy <= 1 && !whiteNeighbor; dy++) {
              for (let dx = -1; dx <= 1 && !whiteNeighbor; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= on.width || ny >= on.height) continue;
                if (!changed[ny * on.width + nx]) continue;
                if (isWhite(on.data, (ny * on.width + nx) * 4)) whiteNeighbor = true;
              }
            }
            if (whiteNeighbor) darkInkWithWhiteNeighbor += 1;
          }
        }

        return {
          width: on.width,
          height: on.height,
          changed: changedCount,
          darkInk,
          darkInkWithWhiteNeighbor,
          minX,
          minY,
          maxX,
          maxY,
        };
      },
      [withLabel.toString("base64"), withoutLabel.toString("base64")] as const,
    );
  } finally {
    await scratch.close();
  }
}

/**
 * The canvas change carries dark glyph ink seated in white halo pixels —
 * THIS is the label proof: the count above only trips the wire.
 */
function expectLabelPixels(stats: LabelDiffStats): void {
  expect(
    stats.changed,
    "the canvas changed at all (tripwire, not the label proof)",
  ).toBeGreaterThan(MIN_CHANGED_PIXELS);
  expect(
    stats.darkInk,
    "the diff carries dark glyph ink — the only paint darker than the highlight ring, so the label rendered",
  ).toBeGreaterThan(MIN_DARK_PIXELS);
  expect(
    stats.darkInkWithWhiteNeighbor,
    "dark glyph ink sits adjacent to white halo pixels (legibility halo)",
  ).toBeGreaterThan(MIN_DARK_WITH_WHITE_NEIGHBOR);
}

test.describe("the pin address label renders on the map canvas", () => {
  // Desktop-pinned: the CI matrix also runs this spec from a phone project,
  // where the app renders the tab layout with the card list hidden — these
  // scenarios exercise the desktop side-by-side surface.
  test.use({ viewport: { width: 1280, height: 720 } });

  test("selecting a unit keeps its address label painted above the pin while the detail is open, and closing the detail erases it", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    await page.getByRole("article").first().getByRole("button").click();
    await expectCameraFocusedOn(page, unit);
    await settleMap(page);
    const withLabel = await canvasShot(page);

    await page.getByTestId("unit-detail").locator(".close").click();
    await settleMap(page);
    const withoutLabel = await canvasShot(page);

    const stats = await labelDiff(page, withLabel, withoutLabel);
    expectLabelPixels(stats);
    // The camera centered the pin, so the label plus ring change must sit in
    // the canvas's central band — the diff is a localized label, not noise.
    expect(stats.minX).toBeGreaterThan(stats.width * 0.2);
    expect(stats.maxX).toBeLessThan(stats.width * 0.8);
    expect(stats.minY).toBeGreaterThan(stats.height * 0.2);
    expect(stats.maxY).toBeLessThan(stats.height * 0.8);
  });

  test("hovering a result card paints its address label and un-hovering erases it", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    await page.getByRole("article").first().getByRole("button").hover();
    await settleMap(page);
    const withLabel = await canvasShot(page);

    await page.mouse.move(0, 0);
    await settleMap(page);
    const withoutLabel = await canvasShot(page);

    expectLabelPixels(await labelDiff(page, withLabel, withoutLabel));
  });

  test("keyboard-focusing a map pin button paints its address label and blurring it erases it", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const pinButton = page.getByTestId("map-pin-list").locator("button").first();
    await pinButton.focus();
    await settleMap(page);
    const withLabel = await canvasShot(page);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await settleMap(page);
    const withoutLabel = await canvasShot(page);

    expectLabelPixels(await labelDiff(page, withLabel, withoutLabel));
  });

  test("the map canvas and the card list panes never overlap on the desktop layout", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const canvasBox = await (await mapCanvas(page)).boundingBox();
    const listBox = await page.locator(".unit-list").boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(listBox).toBeTruthy();
    // Desktop grid: map pane left, card list right — the columns must not
    // overlap, so a map-painted label can never cover card content.
    const onePixelSlack = 1;
    expect(canvasBox!.x + canvasBox!.width).toBeLessThanOrEqual(listBox!.x + onePixelSlack);
  });
});

test.describe("the pin address label on phone (map mounts after the selection)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("after a list-tab selection remounts the phone map on the unit's pin, focusing that unit's keyboard pin paints its label there and blurring erases it", async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole("tab", { name: "List" }).click();
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    await page.getByRole("article").first().getByRole("button").click();
    await expect(page.getByTestId("unit-detail")).toBeVisible();
    // the bottom sheet covers the tab row for pointer taps (pre-existing), so
    // switch tabs the way a keyboard user does — focus the tab and press Enter
    const mapTab = page.getByRole("tab", { name: "Map" });
    await mapTab.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("map-view")).toBeVisible();
    await expectCameraFocusedOn(page, unit);

    // The open detail sheet is a fixed full-viewport bottom sheet: it covers
    // the whole map canvas, so the remounted label cannot be read as pixels
    // while the detail is open. Closing it clears the selection (and with it
    // the label) but the camera stays centered on the unit's pin — and the
    // keyboard pin list shares the result-set order, so that same unit's pin
    // button re-paints the label at the identical framing without a camera
    // move or a sheet.
    await page.getByTestId("unit-detail").locator(".close").click();
    await settleMap(page);

    const pinButton = page.getByTestId("map-pin-list").locator("button").first();
    await pinButton.focus();
    await settleMap(page);
    const withLabel = await canvasShot(page);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await settleMap(page);
    const withoutLabel = await canvasShot(page);

    const stats = await labelDiff(page, withLabel, withoutLabel);
    expectLabelPixels(stats);
    // The camera stayed centered on the remount's unit: the label paints in
    // the central band of the phone canvas.
    expect(stats.minX).toBeGreaterThan(stats.width * 0.2);
    expect(stats.maxX).toBeLessThan(stats.width * 0.8);
    expect(stats.minY).toBeGreaterThan(stats.height * 0.2);
    expect(stats.maxY).toBeLessThan(stats.height * 0.8);
  });
});
