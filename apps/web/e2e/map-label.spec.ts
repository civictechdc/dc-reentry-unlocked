import { expect, test, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";
import { expectCameraFocusedOn, unitBehindFirstCard } from "./steps/map.steps.ts";

/**
 * The address label is a speech bubble (procedurally drawn bubble bitmap
 * stretched behind the text by `icon-text-fit`) painted by the
 * `units-pins-label` symbol layer onto the WebGL canvas — invisible to DOM
 * queries. Every pixel proof compares a label-ON screenshot of the map
 * canvas against a label-OFF screenshot from the SAME camera framing
 * (hover/focus/selection removed; the camera never moves in between), so the
 * only canvas change is the label composite plus its sibling highlight
 * ring. Raster tiles are identical across the pair and contribute no diff
 * pixels. The PNG buffers are decoded with the browser's own canvas 2D API
 * on a blank throwaway page — no image library added to the repo and no
 * dependence on the app page's strict CSP.
 */

/**
 * Change-detection and classification bounds, mirroring the layer's paint
 * constants: a per-channel delta above 32 counts as a changed pixel; dark
 * ink is anything under 80 luminance (the label's explicit `text-color`
 * `#1f2937` ≈ 40; the highlight ring's orange fill ≈ 97 stays above it);
 * white is ≥ 230 per channel (bubble body, tail, ring stroke); the bubble's
 * gray border sits in a narrow band around 204 per channel; the ring's
 * orange fill is red-dominant with low green/blue. The values live in the
 * in-page diff function below.
 */
/**
 * Changed-pixel count is a TRIPWIRE, not the label proof: a bare
 * label-less re-render that only toggles the highlight ring already clears
 * this threshold (ring area ≈ 380 px). The label discriminators are the
 * dark-ink count and the bubble geometry assertions below — the ink is the
 * only paint in the diff set dark enough for the luminance bound, and it
 * must sit INSIDE the white bubble, ABOVE the ring, with tail pixels in
 * between. Do not tune the count up or down believing it proves the label.
 */
const MIN_CHANGED_PIXELS = 250;
/** Any legible glyph run carries at least this many dark ink pixels. */
const MIN_DARK_INK_PIXELS = 25;
/** The bubble's gray border perimeter contributes at least this many pixels. */
const MIN_GRAY_BORDER_PIXELS = 40;
/** The bubble interior, tail, and ring stroke contribute ample white pixels. */
const MIN_WHITE_FILL_PIXELS = 100;
/** The ring's orange fill contributes at least this many pixels. */
const MIN_ORANGE_RING_PIXELS = 30;
/** Rows of white bubble/tail pixels required between the ink and the ring. */
const MIN_WHITE_ROWS_BETWEEN_INK_AND_RING = 3;
/** The ink box must sit this deep inside the bubble box on every side. */
const INK_INSIDE_BUBBLE_PADDING = 2;

/**
 * The canvas repaints on requestAnimationFrame and glyph rasterization and
 * tile decode are not observable from the DOM; a bounded settle wait after
 * the camera attributes go still keeps both screenshots on the same fully
 * painted frame.
 */
const SETTLE_MS = 600;

type Box = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type LabelGeometryStats = {
  width: number;
  height: number;
  changed: number;
  darkInk: number;
  grayBorder: number;
  whiteFill: number;
  orangeRing: number;
  maxInkRow: number;
  minOrangeRow: number;
  whiteRowsBetweenInkAndRing: number;
  inkBBox: Box;
  bubbleBBox: Box;
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
 * framing, with the changed pixels classified into the paint families the
 * label composite and highlight ring are made of. The buffers are decoded
 * on a blank throwaway page (no service worker, no CSP, no data-URL image
 * loader — bytes go in as an array) and only the summary numbers cross
 * back, never the pixel bulk.
 */
async function labelGeometry(
  page: Page,
  withLabel: Buffer,
  withoutLabel: Buffer,
): Promise<LabelGeometryStats> {
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
        const luminance = (data: Uint8ClampedArray, i: number): number =>
          0.299 * channel(data, i) + 0.587 * channel(data, i + 1) + 0.114 * channel(data, i + 2);
        const isDarkInk = (data: Uint8ClampedArray, i: number): boolean => luminance(data, i) < 80;
        const isWhite = (data: Uint8ClampedArray, i: number): boolean =>
          channel(data, i) >= 230 && channel(data, i + 1) >= 230 && channel(data, i + 2) >= 230;
        const isGrayBorder = (data: Uint8ClampedArray, i: number): boolean =>
          channel(data, i) >= 190 &&
          channel(data, i) <= 220 &&
          channel(data, i + 1) >= 190 &&
          channel(data, i + 1) <= 220 &&
          channel(data, i + 2) >= 190 &&
          channel(data, i + 2) <= 220;
        const isOrangeRing = (data: Uint8ClampedArray, i: number): boolean =>
          channel(data, i) >= 180 && channel(data, i + 1) <= 110 && channel(data, i + 2) <= 110;

        const changed = new Uint8Array(on.width * on.height);
        const whiteRows = new Uint8Array(on.height);
        let changedCount = 0;
        let darkInk = 0;
        let grayBorder = 0;
        let whiteFill = 0;
        let orangeRing = 0;
        let maxInkRow = -1;
        let minOrangeRow = on.height;
        const inkBBox = { minX: on.width, minY: on.height, maxX: -1, maxY: -1 };
        const bubbleBBox = { minX: on.width, minY: on.height, maxX: -1, maxY: -1 };
        for (let y = 0; y < on.height; y++) {
          for (let x = 0; x < on.width; x++) {
            const i = (y * on.width + x) * 4;
            const delta = Math.max(
              Math.abs(channel(on.data, i) - channel(off.data, i)),
              Math.abs(channel(on.data, i + 1) - channel(off.data, i + 1)),
              Math.abs(channel(on.data, i + 2) - channel(off.data, i + 2)),
            );
            if (delta <= 32) continue;
            changed[y * on.width + x] = 1;
            changedCount += 1;
            let bubblePixel = false;
            if (isDarkInk(on.data, i)) {
              darkInk += 1;
              maxInkRow = Math.max(maxInkRow, y);
              inkBBox.minX = Math.min(inkBBox.minX, x);
              inkBBox.minY = Math.min(inkBBox.minY, y);
              inkBBox.maxX = Math.max(inkBBox.maxX, x);
              inkBBox.maxY = Math.max(inkBBox.maxY, y);
            } else if (isOrangeRing(on.data, i)) {
              orangeRing += 1;
              minOrangeRow = Math.min(minOrangeRow, y);
            } else {
              if (isWhite(on.data, i)) {
                whiteFill += 1;
                whiteRows[y] = 1;
                bubblePixel = true;
              }
              if (isGrayBorder(on.data, i)) {
                grayBorder += 1;
                bubblePixel = true;
              }
            }
            if (bubblePixel) {
              bubbleBBox.minX = Math.min(bubbleBBox.minX, x);
              bubbleBBox.minY = Math.min(bubbleBBox.minY, y);
              bubbleBBox.maxX = Math.max(bubbleBBox.maxX, x);
              bubbleBBox.maxY = Math.max(bubbleBBox.maxY, y);
            }
          }
        }

        let whiteRowsBetweenInkAndRing = 0;
        for (let y = maxInkRow + 1; y < minOrangeRow; y++) {
          if (whiteRows[y]) whiteRowsBetweenInkAndRing += 1;
        }

        return {
          width: on.width,
          height: on.height,
          changed: changedCount,
          darkInk,
          grayBorder,
          whiteFill,
          orangeRing,
          maxInkRow,
          minOrangeRow,
          whiteRowsBetweenInkAndRing,
          inkBBox,
          bubbleBBox,
        };
      },
      [withLabel.toString("base64"), withoutLabel.toString("base64")] as const,
    );
  } finally {
    await scratch.close();
  }
}

/**
 * The geometry proof: dark glyph ink rendered INSIDE the white bubble, the
 * ink rows sitting entirely ABOVE the highlight ring with bubble/tail white
 * rows filling the gap — the count above only trips the wire.
 */
function expectLabelGeometry(stats: LabelGeometryStats): void {
  expect(
    stats.changed,
    "the canvas changed at all (tripwire, not the label proof)",
  ).toBeGreaterThan(MIN_CHANGED_PIXELS);
  expect(
    stats.darkInk,
    "the diff carries dark glyph ink — the only paint darker than the highlight ring, so the label text rendered",
  ).toBeGreaterThan(MIN_DARK_INK_PIXELS);
  expect(stats.grayBorder, "the bubble's gray border rendered around the text").toBeGreaterThan(
    MIN_GRAY_BORDER_PIXELS,
  );
  expect(stats.whiteFill, "the bubble interior and tail rendered white").toBeGreaterThan(
    MIN_WHITE_FILL_PIXELS,
  );
  expect(stats.orangeRing, "the highlight ring's orange fill rendered").toBeGreaterThan(
    MIN_ORANGE_RING_PIXELS,
  );
  expect(
    stats.maxInkRow,
    "the ink rows sit entirely above the highlight ring rows (label above the pin)",
  ).toBeLessThan(stats.minOrangeRow);
  expect(
    stats.whiteRowsBetweenInkAndRing,
    "white bubble/tail rows fill the gap between the ink bottom and the ring top",
  ).toBeGreaterThanOrEqual(MIN_WHITE_ROWS_BETWEEN_INK_AND_RING);
  expect(
    stats.inkBBox.minX,
    "ink sits inside the bubble box with padding (left side)",
  ).toBeGreaterThanOrEqual(stats.bubbleBBox.minX + INK_INSIDE_BUBBLE_PADDING);
  expect(
    stats.inkBBox.maxX,
    "ink sits inside the bubble box with padding (right side)",
  ).toBeLessThanOrEqual(stats.bubbleBBox.maxX - INK_INSIDE_BUBBLE_PADDING);
  expect(
    stats.inkBBox.minY,
    "ink sits inside the bubble box with padding (top side)",
  ).toBeGreaterThanOrEqual(stats.bubbleBBox.minY + INK_INSIDE_BUBBLE_PADDING);
  expect(
    stats.inkBBox.maxY,
    "ink sits inside the bubble box with padding (bottom side)",
  ).toBeLessThanOrEqual(stats.bubbleBBox.maxY - INK_INSIDE_BUBBLE_PADDING);
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

    const stats = await labelGeometry(page, withLabel, withoutLabel);
    expectLabelGeometry(stats);
    // The camera centered the pin, so the label composite must sit in the
    // canvas's central band — the diff is a localized label, not noise.
    expect(stats.bubbleBBox.minX).toBeGreaterThan(stats.width * 0.2);
    expect(stats.bubbleBBox.maxX).toBeLessThan(stats.width * 0.8);
    expect(stats.bubbleBBox.minY).toBeGreaterThan(stats.height * 0.2);
    expect(stats.inkBBox.maxY).toBeLessThan(stats.height * 0.8);
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

    expectLabelGeometry(await labelGeometry(page, withLabel, withoutLabel));
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

    expectLabelGeometry(await labelGeometry(page, withLabel, withoutLabel));
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

    const stats = await labelGeometry(page, withLabel, withoutLabel);
    expectLabelGeometry(stats);
    // The camera stayed centered on the remount's unit: the label paints in
    // the central band of the phone canvas.
    expect(stats.bubbleBBox.minX).toBeGreaterThan(stats.width * 0.2);
    expect(stats.bubbleBBox.maxX).toBeLessThan(stats.width * 0.8);
    expect(stats.bubbleBBox.minY).toBeGreaterThan(stats.height * 0.2);
    expect(stats.inkBBox.maxY).toBeLessThan(stats.height * 0.8);
  });
});
