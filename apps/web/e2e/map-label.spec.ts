import { expect, test, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";
import {
  canvasShot,
  expectLabelGeometry,
  labelGeometry,
  mapCanvas,
  settleMap,
} from "./steps/label-pixels.ts";
import {
  API_BASE,
  expectCameraFocusedOn,
  parsePinPoints,
  unitBehindFirstCard,
} from "./steps/map.steps.ts";

/**
 * The address label is a speech bubble painted by the `units-pins-label`
 * symbol layer onto the WebGL canvas — invisible to DOM queries. The pixel
 * proof machinery (same-framing label-ON/OFF shots, scratch-page decoding,
 * paint-family classification, geometry assertions) lives in
 * `steps/label-pixels.ts` and is shared with the map dismissal spec.
 */

/** A pin picked to hover: its exact canvas-local center and its unit id. */
type HoverPin = { point: { x: number; y: number }; unitId: string };

/** Edge margin keeping the hovered pin and the bubble above it in the canvas. */
const HOVER_PIN_EDGE_MARGIN_PX = 30;

/**
 * An exact pin center to hover, read from the map's `data-pin-points`
 * attribute (the component's own projections, engine-neutral by
 * construction) rather than a raster scan. Picks the fully in-canvas pin
 * with the maximal edge distance — the same preference the retired pixel
 * scan applied — and resolves its unit id by the shared result-set order:
 * the attribute serializes the store's units in order, the card list
 * iterates the same array, and the served payload feeds both. A divergent
 * order cannot pass silently — the label assertion below demands exactly the
 * picked index's unit id, and the corpus places every unit on its own
 * coordinates, so no duplicate pin can answer for another.
 */
async function canvasPinToHover(
  page: Page,
  canvasBox: { width: number; height: number },
): Promise<HoverPin> {
  const mapRegion = page.getByTestId("map-view");
  await expect
    .poll(
      async () => await mapRegion.getAttribute("data-pin-points"),
      "the map publishes its rendered pin centers once the pin source loads",
    )
    .toMatch(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
  const pins = parsePinPoints(await mapRegion.getAttribute("data-pin-points"));
  const margin = HOVER_PIN_EDGE_MARGIN_PX;
  const inCanvas = pins
    .map((point, index) => ({ point, index }))
    .filter(
      ({ point }) =>
        point.x >= margin &&
        point.x <= canvasBox.width - margin &&
        point.y >= margin &&
        point.y <= canvasBox.height - margin,
    );
  expect(inCanvas.length, "the locale view holds rendered pins inside the canvas").toBeGreaterThan(
    0,
  );
  const chosen = inCanvas.reduce((best, candidate) => {
    const edge = (p: { x: number; y: number }) =>
      Math.min(p.x, canvasBox.width - p.x, p.y, canvasBox.height - p.y);
    return edge(candidate.point) > edge(best.point) ? candidate : best;
  });
  const response = await page.request.get(`${API_BASE}/units`);
  expect(response.ok(), "the units endpoint answers for the hover helper").toBeTruthy();
  const { units } = (await response.json()) as { units: Array<{ id: string }> };
  const unit = units[chosen.index];
  expect(unit, "the picked pin's result-set index resolves to a unit").toBeTruthy();
  return { point: chosen.point, unitId: unit!.id };
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
    // 2px rasterization tolerance: software renderers place the composite
    // within ~1px of the Chromium raster (observed 0.8px on CI Firefox);
    // the band is the invariant, not the sub-pixel position.
    const rasterTolerance = 2;
    expect(stats.bubbleBBox.minX).toBeGreaterThan(stats.width * 0.2 - rasterTolerance);
    expect(stats.bubbleBBox.maxX).toBeLessThan(stats.width * 0.8 + rasterTolerance);
    expect(stats.bubbleBBox.minY).toBeGreaterThan(stats.height * 0.2 - rasterTolerance);
    expect(stats.inkBBox.maxY).toBeLessThan(stats.height * 0.8 + rasterTolerance);
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

  test("hovering a canvas pin paints its address label and moving the pointer away erases it", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    // The initial no-selection view: pins only, no label. The camera
    // attributes are recorded before the hover — hovering a pin must never
    // move the camera the way a selection does.
    const mapRegion = page.getByTestId("map-view");
    // The hover must land on a *rendered* pin: `data-pin-points` publishes
    // projections before tiles rasterize, but the hover label arms only from
    // MapLibre layer events, which fire on features queryable in the current
    // frame — so the map settles before the pointer moves (webkit
    // software-GL rasterizes slowest, and this single mouse-move has no
    // later movement to correct it).
    await settleMap(page);
    const canvasBox = await (await mapCanvas(page)).boundingBox();
    const pin = await canvasPinToHover(page, canvasBox!);
    const centerBefore = await mapRegion.getAttribute("data-map-center");
    const zoomBefore = await mapRegion.getAttribute("data-map-zoom");

    await page.mouse.move(canvasBox!.x + pin.point.x, canvasBox!.y + pin.point.y);
    // The component registers a canvas-pin hover behind a short enter-intent
    // timer, so the label ownership polls for the attribute rather than
    // guessing the delay; the settle still covers glyph rasterization and
    // tile settling for the sibling pixel proofs' framing discipline.
    await expect(mapRegion).toHaveAttribute("data-label-unit", pin.unitId);
    await settleMap(page);

    await page.mouse.move(0, 0);
    await expect(mapRegion).toHaveAttribute("data-label-unit", "none");
    await settleMap(page);

    // A hover never selects: no detail opened and the camera stayed put.
    await expect(page.getByTestId("unit-detail")).toHaveCount(0);
    expect(await mapRegion.getAttribute("data-map-center")).toBe(centerBefore);
    expect(await mapRegion.getAttribute("data-map-zoom")).toBe(zoomBefore);
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
    // 2px rasterization tolerance: software renderers place the composite
    // within ~1px of the Chromium raster (observed 0.8px on CI Firefox);
    // the band is the invariant, not the sub-pixel position.
    const rasterTolerance = 2;
    expect(stats.bubbleBBox.minX).toBeGreaterThan(stats.width * 0.2 - rasterTolerance);
    expect(stats.bubbleBBox.maxX).toBeLessThan(stats.width * 0.8 + rasterTolerance);
    expect(stats.bubbleBBox.minY).toBeGreaterThan(stats.height * 0.2 - rasterTolerance);
    expect(stats.inkBBox.maxY).toBeLessThan(stats.height * 0.8 + rasterTolerance);
  });
});
