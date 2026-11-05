import { expect, type Page } from "@playwright/test";

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
export const MIN_CHANGED_PIXELS = 250;
/** Any legible glyph run carries at least this many dark ink pixels. */
export const MIN_DARK_INK_PIXELS = 25;
/** The bubble's gray border perimeter contributes at least this many pixels. */
export const MIN_GRAY_BORDER_PIXELS = 40;
/** The bubble interior, tail, and ring stroke contribute ample white pixels. */
export const MIN_WHITE_FILL_PIXELS = 100;
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

export type LabelGeometryStats = {
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

export async function mapCanvas(page: Page) {
  const canvas = page.locator('[data-testid="map-view"] .map-canvas canvas');
  await expect(canvas).toBeVisible();
  return canvas;
}

/** Tiles fetched, camera still, glyphs rasterized: safe to screenshot. */
export async function settleMap(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(SETTLE_MS);
}

export async function canvasShot(page: Page): Promise<Buffer> {
  return await (await mapCanvas(page)).screenshot();
}

/**
 * Pixel-level diff of two label-ON/OFF canvas screenshots of the same
 * framing, with the changed pixels classified into the paint families the
 * label composite and highlight ring are made of. The classification reads
 * the FIRST buffer, so pass the label-present shot first. The buffers are
 * decoded on a blank throwaway page (no service worker, no CSP, no data-URL
 * image loader — bytes go in as an array) and only the summary numbers
 * cross back, never the pixel bulk.
 */
export async function labelGeometry(
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
export function expectLabelGeometry(stats: LabelGeometryStats): void {
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

/**
 * The presence proof, for diffs whose framing MOVED between shots (panned,
 * flown): the removed-or-added composite still shows its paint families
 * (bubble white body/tail, gray border, glyph ink) but the ink-above-ring
 * ordering and the box paddings can no longer be trusted — removing a ring
 * exposes the raster tile beneath it, and dark tile paint (vegetation,
 * street label text) lands in the diff with the same luminance family as
 * glyph ink. Use `expectLabelGeometry` for same-framing centered proofs and
 * this for proofs on a moved framing.
 */
export function expectLabelCompositePresent(stats: LabelGeometryStats): void {
  expect(
    stats.changed,
    "the canvas changed at all (tripwire, not the label proof)",
  ).toBeGreaterThan(MIN_CHANGED_PIXELS);
  expect(stats.whiteFill, "the bubble body and tail white paint is in the diff").toBeGreaterThan(
    MIN_WHITE_FILL_PIXELS,
  );
  expect(stats.grayBorder, "the bubble's gray border paint is in the diff").toBeGreaterThan(
    MIN_GRAY_BORDER_PIXELS,
  );
  expect(stats.darkInk, "dark glyph-ink-family paint is in the diff").toBeGreaterThan(
    MIN_DARK_INK_PIXELS,
  );
}

/**
 * Screen-positions for clicking the canvas WITHOUT hitting a pin. Pins are
 * the only blue paint on the raster style (base circle `#0b5fab`; the
 * highlight ring's red-orange `#d9340f` is equally un-tile-like — raster
 * OSM water blues are far lighter and carry high green), so a screenshot
 * scan for those two paint families finds genuinely empty canvas. The one
 * address-label bubble always rides the highlighted pin, which a selection
 * camera has just centered — pass `excludeLabelBubble: true` to keep the
 * central band out of the scan for it (and only when a selection actually
 * exists; the bubble zone would otherwise swallow a whole narrow phone
 * canvas). Returns canvas-LOCAL coordinates (add the canvas bounding box
 * origin to obtain page coordinates).
 */
export async function pinFreeCanvasPoint(
  page: Page,
  options: { excludeLabelBubble?: boolean } = {},
): Promise<{ x: number; y: number }> {
  const shot = await canvasShot(page);
  const scratch = await page.context().newPage();
  try {
    const excludeLabelBand = options.excludeLabelBubble === true;
    return await scratch.evaluate(
      async ([base64, bandExcluded]) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D canvas context unavailable for the pin scan");
        context.drawImage(bitmap, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const width = image.width;
        const height = image.height;
        const channel = (x: number, y: number, offset: number): number => {
          const index = (y * width + x) * 4 + offset;
          return image.data[index]!;
        };
        const isPinPaint = (x: number, y: number): boolean => {
          if (x < 0 || y < 0 || x >= width || y >= height) return false;
          const red = channel(x, y, 0);
          const green = channel(x, y, 1);
          const blue = channel(x, y, 2);
          const bluePin = blue >= 130 && blue - red >= 70 && green >= 50 && green <= 140;
          const orangeRing = red >= 170 && green <= 120 && blue <= 120;
          return bluePin || orangeRing;
        };
        const centerX = width / 2;
        const centerY = height / 2;
        const labelBubbleZone = (x: number, y: number): boolean =>
          bandExcluded && Math.abs(x - centerX) <= 260 && y >= centerY - 110 && y <= centerY + 30;
        const clearanceRadius = 26;
        let best: { x: number; y: number; edgeDistance: number } | null = null;
        for (let y = 20; y < height - 20; y += 8) {
          for (let x = 20; x < width - 20; x += 8) {
            if (labelBubbleZone(x, y)) continue;
            let clear = true;
            scan: for (let dy = -clearanceRadius; dy <= clearanceRadius; dy += 2) {
              for (let dx = -clearanceRadius; dx <= clearanceRadius; dx += 2) {
                if (dx * dx + dy * dy > clearanceRadius * clearanceRadius) continue;
                if (isPinPaint(x + dx, y + dy)) {
                  clear = false;
                  break scan;
                }
              }
            }
            if (!clear) continue;
            const edgeDistance = Math.min(x, width - x, y, height - y);
            if (!best || edgeDistance > best.edgeDistance) best = { x, y, edgeDistance };
          }
        }
        if (!best) throw new Error("the canvas scan found no pin-free point to click");
        return { x: best.x, y: best.y };
      },
      [shot.toString("base64"), excludeLabelBand] as const,
    );
  } finally {
    await scratch.close();
  }
}

/**
 * A screen-position ON a pin's canvas circle, for pointer-hover proofs: a
 * scan for the base pin's blue paint family (`#0b5fab` — the only blue of
 * that family over the OSM raster; water blues are far lighter with high
 * green), kept to points whose whole small disk is solid pin blue, so the
 * returned point sits within a few pixels of a circle's center and a
 * `mouse.move` onto it lands INSIDE the pin's hit geometry. The scan runs
 * on the initial no-selection view (blue circles only, no highlight rings,
 * no label bubble). Like the sibling pin-free scan, screenshot pixels are
 * returned as canvas-LOCAL coordinates on the desktop-chrome project's
 * deviceScaleFactor 1 (add the canvas bounding box origin to obtain page
 * coordinates).
 */
export async function pinCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
  // The first canvas frame after load can still be settling (tile fade-in,
  // a compositor frame with a cleared WebGL buffer — this proof's first
  // shot happens on a quiescent canvas, with no camera move to guarantee a
  // fresh paint): a scan that finds no pin re-settles the map and rescans a
  // bounded number of times before failing.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await settleMap(page);
    try {
      return await scanPinCanvasPoint(page);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** One scan pass of {@link pinCanvasPoint}: shot, decode, classify, pick. */
async function scanPinCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
  const shot = await canvasShot(page);
  const scratch = await page.context().newPage();
  try {
    return await scratch.evaluate(async (base64: string) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("2D canvas context unavailable for the pin scan");
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const width = image.width;
      const height = image.height;
      const channel = (x: number, y: number, offset: number): number => {
        const index = (y * width + x) * 4 + offset;
        return image.data[index]!;
      };
      const isPinBlue = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        const red = channel(x, y, 0);
        const green = channel(x, y, 1);
        const blue = channel(x, y, 2);
        return blue >= 130 && blue - red >= 70 && green >= 50 && green <= 140;
      };
      // A fully-blue disk of this radius proves the point sits well inside
      // a circle (base radius 6 CSS px + stroke): at most ~3 px off center.
      const solidRadius = 3;
      const sitsOnPin = (x: number, y: number): boolean => {
        for (let dy = -solidRadius; dy <= solidRadius; dy += 2) {
          for (let dx = -solidRadius; dx <= solidRadius; dx += 2) {
            if (dx * dx + dy * dy > solidRadius * solidRadius) continue;
            if (!isPinBlue(x + dx, y + dy)) return false;
          }
        }
        return true;
      };
      let best: { x: number; y: number; edgeDistance: number } | null = null;
      for (let y = 20; y < height - 20; y += 2) {
        for (let x = 20; x < width - 20; x += 2) {
          if (!sitsOnPin(x, y)) continue;
          const edgeDistance = Math.min(x, width - x, y, height - y);
          if (!best || edgeDistance > best.edgeDistance) best = { x, y, edgeDistance };
        }
      }
      if (!best) throw new Error("the canvas scan found no visible pin to hover");
      return { x: best.x, y: best.y };
    }, shot.toString("base64"));
  } finally {
    await scratch.close();
  }
}
