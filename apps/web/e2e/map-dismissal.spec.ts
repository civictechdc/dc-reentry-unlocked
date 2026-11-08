import { expect, test, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";
import {
  MIN_CHANGED_PIXELS,
  canvasShot,
  expectLabelCompositePresent,
  expectLabelGeometry,
  labelGeometry,
  mapCanvas,
  pinFreeCanvasPoint,
  settleMap,
} from "./steps/label-pixels.ts";
import { expectCameraFocusedOn, unitBehindFirstCard } from "./steps/map.steps.ts";

/**
 * Canvas click/tap dismissal proofs. A canvas click that lands on NO pin
 * clears the card hover, the pin hover, and the selection — the detail
 * slide-over closes and the address-label layer drops back to its no-match
 * filter (no pin labeled, no highlight ring). Panning (click-drag or
 * tap-drag) must never dismiss: MapLibre suppresses the click that trails a
 * completed drag, so the proofs below double as the arbiter — a run where a
 * drag pans AND dismisses falsifies that suppression.
 *
 * Pixel proofs use the shared label machinery in `steps/label-pixels.ts`
 * (same-framing screenshots, scratch-page decoding, paint-family
 * classification); camera proofs read the `data-map-center` / `data-map-zoom`
 * attributes the map section refreshes on `moveend`.
 *
 * Phone geometry fact this suite works within: the open detail sheet is a
 * fixed bottom sheet measured at the FULL viewport (390×844, anchored at
 * y=0) for every unit, so a selection and its sheet cover the whole map
 * canvas — a tap-off dismissal has no reachable canvas surface on phone and
 * is proven on desktop only. The reachable touch half — a tap-drag pans
 * without a phantom click opening anything — is proven on the phone canvas.
 */

type ListedUnit = {
  id: string;
  address: string;
  program: { name: string };
  coordinates: { latitude: number; longitude: number };
};

/** The map's serialized camera center (`"<lng>,<lat>"`, refreshed on moveend). */
async function mapCenter(page: Page): Promise<string> {
  return (await page.getByTestId("map-view").getAttribute("data-map-center"))!;
}

function distanceInDegrees(first: string, second: string): number {
  const [firstLng, firstLat] = first.split(",").map(Number) as [number, number];
  const [secondLng, secondLat] = second.split(",").map(Number) as [number, number];
  return Math.hypot(firstLng - secondLng, firstLat - secondLat);
}

/**
 * MapLibre's flick inertia keeps easing the camera after a drag ends, and
 * the attribute only refreshes on `moveend` — sample until two reads agree
 * so any screenshot proof starts from a settled framing.
 */
async function awaitCameraStill(page: Page): Promise<string> {
  let previous = await mapCenter(page);
  for (let sample = 0; sample < 25; sample++) {
    await page.waitForTimeout(400);
    const current = await mapCenter(page);
    if (current === previous) return current;
    previous = current;
  }
  return previous;
}

/**
 * The first three card-list positions whose units sit on pairwise-distinct
 * pins (read from the served result set via each card's heading anchor).
 * Distinct coordinates are what make label MOVEMENT visible as pixels: when
 * the label falls back to the selected unit it cannot silently overlap an
 * earlier pin's spot.
 */
async function threeDistinctPinCards(page: Page): Promise<{
  first: { index: number; unit: ListedUnit };
  second: { index: number; unit: ListedUnit };
  third: { index: number; unit: ListedUnit };
}> {
  const apiBase = process.env.VITE_API_URL ?? "http://localhost:3000";
  const response = await page.request.get(`${apiBase}/units`);
  expect(response.ok(), "the units endpoint answers for the card helper").toBeTruthy();
  const { units } = (await response.json()) as { units: ListedUnit[] };
  const cards = page.getByRole("article");
  const cardCount = await cards.count();
  const picked: Array<{ index: number; unit: ListedUnit }> = [];
  for (let index = 0; index < cardCount && picked.length < 3; index++) {
    const labelledby = await cards.nth(index).getAttribute("aria-labelledby");
    const unitId = labelledby?.replace(/^card-title-/, "") ?? "";
    const unit = units.find((candidate) => candidate.id === unitId);
    if (!unit) continue;
    const distinctPin = picked.every(
      (existing) =>
        Math.abs(existing.unit.coordinates.latitude - unit.coordinates.latitude) > 1e-4 ||
        Math.abs(existing.unit.coordinates.longitude - unit.coordinates.longitude) > 1e-4,
    );
    if (distinctPin) picked.push({ index, unit });
  }
  expect(picked, "the card list holds three units on distinct pins").toHaveLength(3);
  return { first: picked[0]!, second: picked[1]!, third: picked[2]! };
}

test.describe("canvas click dismissal and drag pan on desktop", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("clicking empty canvas with the detail open dismisses the selection, closes the detail, and erases the pin label without moving the camera", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    await page.getByRole("article").first().getByRole("button").click();
    await expectCameraFocusedOn(page, unit);
    await expect(page.getByTestId("unit-detail")).toBeVisible();
    await settleMap(page);
    const withLabel = await canvasShot(page);
    const centerWithSelection = await mapCenter(page);

    const point = await pinFreeCanvasPoint(page, { excludeLabelBubble: true });
    const canvasBox = await (await mapCanvas(page)).boundingBox();
    await page.mouse.click(canvasBox!.x + point.x, canvasBox!.y + point.y);
    await settleMap(page);

    await expect(page.getByTestId("unit-detail")).toHaveCount(0);
    expect(
      await mapCenter(page),
      "the click-off dismissal never moves the camera, so both shots share one framing",
    ).toBe(centerWithSelection);
    expectLabelGeometry(await labelGeometry(page, withLabel, await canvasShot(page)));
  });

  test("click-dragging the map pans the camera and keeps the selection, the detail, and the pin label open", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    const unit = await unitBehindFirstCard(page);

    await page.getByRole("article").first().getByRole("button").click();
    await expectCameraFocusedOn(page, unit);
    const detail = page.getByTestId("unit-detail");
    await expect(detail).toBeVisible();
    await settleMap(page);

    const canvasBox = await (await mapCanvas(page)).boundingBox();
    const startX = canvasBox!.x + canvasBox!.width / 2;
    const startY = canvasBox!.y + canvasBox!.height / 2;
    // The pan drag stays inside the canvas: MapLibre abandons the gesture
    // once the pointer leaves the map, so the drag length is proportional to
    // the actual (aspect-capped) canvas rather than fixed pixels that could
    // exit a narrow pane.
    const dragRamp = 0.4;
    const dragX = canvasBox!.width * dragRamp;
    const dragY = canvasBox!.height * dragRamp;
    const centerBeforePan = await mapCenter(page);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dragX / 2, startY + dragY / 2, { steps: 5 });
    await page.mouse.move(startX + dragX, startY + dragY, { steps: 12 });
    await page.mouse.up();
    const centerAfterPan = await awaitCameraStill(page);
    await settleMap(page);

    expect(
      distanceInDegrees(centerBeforePan, centerAfterPan),
      "the drag panned the camera a real distance, not a rounding step",
    ).toBeGreaterThan(0.001);
    await expect(detail).toBeVisible();
    await expect(detail, "the pan kept the same selection's detail open").toContainText(
      unit.address,
    );

    // The label survived the pan: closing the detail now (which clears the
    // selection without moving the camera) must erase exactly the label
    // composite from the same framing.
    const labelAfterPan = await canvasShot(page);
    const centerWithDetail = await mapCenter(page);
    await detail.locator(".close").click();
    await settleMap(page);
    const labelAfterClose = await canvasShot(page);
    await expect(detail).toHaveCount(0);
    expect(await mapCenter(page)).toBe(centerWithDetail);
    // The pan moved the pin over fresh tiles, so this proof is a presence
    // proof (see the helper's doc) — the bubble paint families must vanish
    // from the canvas when the detail closes, on the same framing.
    expectLabelCompositePresent(await labelGeometry(page, labelAfterPan, labelAfterClose));
  });

  test("the pin label follows a hovered card only while hovered and returns to the selected unit's pin, never to an earlier canvas-picked pin", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);
    const { first: cardA, second: cardB, third: cardC } = await threeDistinctPinCards(page);

    // Select the first card so the camera centers its pin, then click the
    // canvas pin itself — the canvas-pin path pins BOTH the pin hover and
    // the selection on that unit (the stale-hover hazard this proof guards).
    await page.getByRole("article").nth(cardA.index).getByRole("button").click();
    await expectCameraFocusedOn(page, cardA.unit);
    await settleMap(page);
    const centerOnPinA = await mapCenter(page);
    const canvasBox = await (await mapCanvas(page)).boundingBox();
    await page.mouse.click(
      canvasBox!.x + canvasBox!.width / 2,
      canvasBox!.y + canvasBox!.height / 2,
    );
    await settleMap(page);
    const detail = page.getByTestId("unit-detail");
    await expect(
      detail,
      "the canvas click hit the focused pin: the detail stays open",
    ).toBeVisible();
    await expect(detail).toContainText(cardA.unit.address);
    expect(
      await mapCenter(page),
      "the canvas pin click re-picked the focused unit rather than dismissing or flying elsewhere",
    ).toBe(centerOnPinA);

    // A card selection demotes the canvas-pin hover and flies to its own pin.
    // The open detail slide-over overlays the card column (absolute, right
    // side), so the selection is made the way a keyboard user makes it —
    // focus the card button and press Enter; the click event reaches the
    // same selection path a pointer click would.
    await page.getByRole("article").nth(cardB.index).getByRole("button").focus();
    await page.keyboard.press("Enter");
    const mapRegion = page.getByTestId("map-view");
    await expect(mapRegion).toHaveAttribute("data-map-zoom", "16", { timeout: 20_000 });
    await expect.poll(() => mapCenter(page), { timeout: 20_000 }).not.toBe(centerOnPinA);
    // The card button keeps focus after activation, which holds the card's
    // own hover slot; blur it so the label below rides the bare selection.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await settleMap(page);
    const labelOnB = await canvasShot(page);

    // Borrowing the label borrows the card's hover slot: card focus drives
    // the same state as a pointer hover (onfocus mirrors onpointerenter), so
    // the card is hovered the way a keyboard user hovers it — focus held,
    // then released.
    await page.getByRole("article").nth(cardC.index).getByRole("button").focus();
    await settleMap(page);
    const labelOnCHover = await canvasShot(page);

    // Un-hover: the label must fall back to the SELECTION (B) — pixel-equal
    // to the pre-hover framing, so no pin anywhere on the canvas (the
    // canvas-picked pin included) carries the label after the release.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await settleMap(page);
    const labelBackOnB = await canvasShot(page);

    const returnTrip = await labelGeometry(page, labelOnB, labelBackOnB);
    expect(
      returnTrip.darkInk,
      "after the un-hover the canvas matches the selection-labeled framing glyph-for-glyph — the label returned to the selected pin and no other pin (the canvas-picked one included) gained a label",
    ).toBe(0);
    expect(
      returnTrip.changed,
      "no label-scale composite change remains after the un-hover",
    ).toBeLessThan(MIN_CHANGED_PIXELS);

    const borrowedTrip = await labelGeometry(page, labelOnB, labelOnCHover);
    expect(
      borrowedTrip.changed,
      "hovering the third card genuinely moved the label off the selected pin (or erased it) — the borrow was visible on the canvas",
    ).toBeGreaterThan(MIN_CHANGED_PIXELS);
  });

  test("closing the detail with Escape returns keyboard focus to the card button that opened it", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const cardButton = page.getByRole("article").first().getByRole("button");
    await cardButton.focus();
    await page.keyboard.press("Enter");
    const detail = page.getByTestId("unit-detail");
    await expect(detail).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    const focusReturnedToOpener = await page.evaluate(() => {
      const opener = document.querySelector("article")?.querySelector("button") ?? null;
      return opener !== null && document.activeElement === opener;
    });
    expect(
      focusReturnedToOpener,
      "Escape put focus back on the first card's button, not on the page body",
    ).toBe(true);
  });
});

test.describe("tap-drag pan on phone (touch)", () => {
  // Touch-capable phone viewport: the drag is dispatched as a real touch
  // sequence over the Chromium DevTools protocol (Input.dispatchTouchEvent) —
  // the suite has no page-level touch-drag API and this drives the same
  // pointer pipeline a finger does.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("tap-dragging the phone map pans the camera without opening the detail sheet", async ({
    page,
    browserName,
  }) => {
    // Browser-input-level touch synthesis is Chromium-only (CDP
    // Input.dispatchTouchEvent); Firefox and WebKit expose no equivalent
    // injection API, and a DOM-event approximation would no longer test the
    // real input pipeline. Skip honestly rather than fake it; remove this
    // guard when Playwright grows cross-engine touch-drag injection.
    test.skip(browserName !== "chromium", "touch-drag injection needs CDP (Chromium-only)");
    await openApp(page);
    await expect(page.getByTestId("map-view")).toBeVisible();
    await settleMap(page);

    const canvasBox = await (await mapCanvas(page)).boundingBox();
    const startX = canvasBox!.x + canvasBox!.width / 2;
    const startY = canvasBox!.y + canvasBox!.height / 2;
    // The drag must END off any pin: a trailing click there would be the
    // falsifying phantom (a drag that ends by selecting).
    const end = await pinFreeCanvasPoint(page);
    const endX = canvasBox!.x + end.x;
    const endY = canvasBox!.y + end.y;

    const session = await page.context().newCDPSession(page);
    const centerBeforePan = await mapCenter(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY }],
    });
    for (let step = 1; step <= 10; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: startX + ((endX - startX) * step) / 10,
            y: startY + ((endY - startY) * step) / 10,
          },
        ],
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const centerAfterPan = await awaitCameraStill(page);
    await settleMap(page);

    expect(
      distanceInDegrees(centerBeforePan, centerAfterPan),
      "the touch drag panned the camera a real distance",
    ).toBeGreaterThan(0.001);
    await expect(
      page.getByTestId("unit-detail"),
      "the touch drag left no phantom selection behind — no detail sheet opened",
    ).toHaveCount(0);
  });
});
