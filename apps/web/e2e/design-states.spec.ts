import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectResultsLoaded, openApp } from "./steps/app.steps.ts";
import { canvasShot, expectLabelGeometry, labelGeometry, settleMap } from "./steps/label-pixels.ts";
import { expectCameraFocusedOn, unitBehindFirstCard } from "./steps/map.steps.ts";

/**
 * Rendered design-token state probes: for each interactive state the app
 * renders (keyboard focus, selected, hover, verification badges, and the
 * canvas-painted map label), the element's computed style must equal the
 * design token its stylesheet declares. Tokens are read live from `:root`
 * and normalized through the engine's own color serialization — no color
 * literal is hardcoded here, so a palette change stays green while broken
 * wiring (an element no longer consuming its token) fails.
 */

/**
 * The card-list surface for the unpinned main-screen probes: on the phone
 * layout the app boots on the map tab and the card list is one tab away —
 * a phone user switches to the List tab to see cards (the phone-native
 * specs do the same). Wait for whichever surface appears first so the
 * desktop layout falls through without a fixed delay.
 */
async function openCardList(page: Page): Promise<void> {
  await openApp(page);
  const listTab = page.getByRole("tab", { name: "List" });
  const firstSurface = listTab.or(page.locator(".unit-list article").first());
  await firstSurface.first().waitFor({ state: "visible", timeout: 20_000 });
  if (await listTab.isVisible()) {
    await listTab.click();
  }
  await expectResultsLoaded(page);
}

test.beforeEach(async ({ page }, testInfo) => {
  // Record the engine that actually executes each probe: the run log itself
  // proves which browser versions the matrix exercised.
  const browser = page.context().browser();
  const engine = browser
    ? `${browser.browserType().name()} ${browser.version()}`
    : "unknown browser";
  const line = `${testInfo.project.name}: ${engine}`;
  testInfo.annotations.push({ type: "engine", description: line });
  console.log(`[engine-version] ${line}`);
});

/**
 * The value a token resolves to on `:root`, normalized through the engine's
 * own color parser (a probe element's computed `color`) so the comparison
 * below is a same-engine serialization on both sides.
 */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const declared = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!declared) throw new Error(`design token ${name} is not defined on :root`);
    const probe = document.createElement("span");
    probe.style.color = declared;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, token);
}

/**
 * A computed longhand must equal a resolved token color — the rendered
 * counterpart of the stylesheet's `var(--token)` consumer.
 */
async function expectTokenColor(
  page: Page,
  locator: Locator,
  property: string,
  token: string,
  because: string,
): Promise<void> {
  const [styles, resolved] = await Promise.all([
    locator.evaluate(
      (element, names) => {
        const style = getComputedStyle(element);
        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
      },
      [property],
    ),
    tokenColor(page, token),
  ]);
  expect(styles[property], because).toBe(resolved);
}

test.describe("the shared keyboard focus ring", () => {
  // Desktop-pinned: the probe target is a keyboard map-pin button, a
  // control the desktop side-by-side layout renders (the phone List tab
  // keeps the map unmounted). The CI matrix's phone project runs this
  // describe with the desktop layout, same as the other desktop-pinned
  // describes.
  test.use({ viewport: { width: 1280, height: 720 } });

  test("focusing a map pin by keyboard paints its focus ring with the focus-ring token at nonzero width and offset", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const pinButton = page.getByTestId("map-pin-list").locator("button").first();
    // Engines disagree on how :focus-visible reveals — the keyboard a11y
    // probe documents the same split: WebKit and Chromium match script
    // focus(); Firefox does not, and there the honest path is the trusted
    // Tab walk from document start. (macOS WebKit additionally skips
    // buttons entirely in its default Tab order, so the walk alone cannot
    // reach the pin there.)
    await pinButton.focus({ timeout: 10_000 });
    const revealed = await pinButton.evaluate((element) => element.matches(":focus-visible"));
    if (!revealed) {
      await page.reload();
      await expectResultsLoaded(page);
      let reached = false;
      for (let tabs = 0; tabs < 40 && !reached; tabs += 1) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(() => {
          const list = document.querySelector("[data-testid=map-pin-list]");
          return list?.contains(document.activeElement) ?? false;
        });
      }
      expect(reached, "a keyboard map pin is reachable by keyboard alone").toBe(true);
    }

    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return {
        color: style.outlineColor,
        width: style.outlineWidth,
        offset: style.outlineOffset,
      };
    });
    const focusRingToken = await tokenColor(page, "--color-accent-focus-ring");
    expect(ring.color, "the focus ring paints the resolved --color-accent-focus-ring").toBe(
      focusRingToken,
    );
    expect(Number.parseFloat(ring.width), "the focus ring is visible").toBeGreaterThan(0);
    expect(
      Number.parseFloat(ring.offset),
      "the focus ring sits off the control's edge",
    ).toBeGreaterThan(0);
  });
});

test.describe("selected filter and card states", () => {
  // Desktop-pinned: the selected-toggle and chip surfaces belong to the
  // desktop filter bar; the phone layout keeps filters behind the sheet and
  // renders its own summary chips instead. The CI matrix's phone project
  // runs this describe with the desktop layout.
  test.use({ viewport: { width: 1280, height: 720 } });

  test("selecting a ward filter paints its toggle with the accent and on-accent tokens and its chip with the surface-selected token", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const ward1 = page.locator(".filter-bar").getByRole("button", { name: "Ward 1", exact: true });
    await ward1.click();
    await expect(page.getByText("Ward: Ward 1")).toBeVisible({ timeout: 20_000 });

    await expectTokenColor(
      page,
      ward1,
      "background-color",
      "--color-accent",
      "the selected toggle's surface paints the accent token",
    );
    await expectTokenColor(
      page,
      ward1,
      "color",
      "--color-ink-on-accent",
      "the selected toggle's label paints the on-accent ink token",
    );
    await expectTokenColor(
      page,
      ward1,
      "border-top-color",
      "--color-accent",
      "the selected toggle's edge paints the accent token",
    );

    const chip = page.locator(".chips .chip").filter({ hasText: "Ward: Ward 1" });
    await expectTokenColor(
      page,
      chip,
      "background-color",
      "--color-surface-selected",
      "the active-filter chip paints the surface-selected token",
    );
  });

  test("selecting a unit paints its card outline and edge with the accent token", async ({
    page,
  }) => {
    await openApp(page);
    await expectResultsLoaded(page);

    const card = page.getByRole("article").first();
    await card.getByRole("button").click();
    await expect(page.getByTestId("unit-detail")).toBeVisible();

    await expectTokenColor(
      page,
      card,
      "outline-color",
      "--color-accent",
      "the selected card's selection outline paints the accent token",
    );
    await expectTokenColor(
      page,
      card,
      "border-top-color",
      "--color-accent",
      "the selected card's border paints the accent token",
    );
    const outlineWidth = await card.evaluate((element) => getComputedStyle(element).outlineWidth);
    expect(Number.parseFloat(outlineWidth), "the selection outline is visible").toBeGreaterThan(0);
  });
});

test.describe("hover states", () => {
  // No viewport pin: both hover surfaces render in every boot and layout.
  // The primary action is the error page's call to action — the only
  // control whose hover keys a background swap to the accent-hover token.
  // The quiet hover is the unit card's highlight (a pointerenter-driven
  // class, not a CSS :hover rule) — the app's quiet controls key their
  // hover on an accent outline/edge, not a background swap, and the probe
  // asserts what actually renders.
  test("hovering the primary action paints its surface with the accent-hover token", async ({
    page,
  }) => {
    await page.goto("/definitely-not-a-route");
    const back = page.getByRole("link", { name: "Back to available units" });
    await expect(back).toBeVisible();

    await expectTokenColor(
      page,
      back,
      "background-color",
      "--color-accent",
      "the primary action rests on the accent token",
    );
    await expectTokenColor(
      page,
      back,
      "color",
      "--color-ink-on-accent",
      "the primary action's label paints the on-accent ink token",
    );

    await back.hover();
    await expectTokenColor(
      page,
      back,
      "background-color",
      "--color-accent-hover",
      "the hovered primary action paints the accent-hover token",
    );
  });

  test("hovering a unit card paints its highlight edge with the accent token and leaving erases it", async ({
    page,
  }) => {
    await openCardList(page);

    const card = page.getByRole("article").first();
    await card.getByRole("button").hover();
    await expectTokenColor(
      page,
      card,
      "border-top-color",
      "--color-accent",
      "the hovered card's edge paints the accent token",
    );
    // A hover never selects.
    await expect(page.getByTestId("unit-detail")).toHaveCount(0);

    await page.mouse.move(0, 0);
    await expectTokenColor(
      page,
      card,
      "border-top-color",
      "--color-line",
      "the un-hovered card's edge returns to the resting line token",
    );
  });
});

test.describe("verification badges", () => {
  // No viewport pin: cards render their badges in both layouts.
  test("confirmed and unverified badges each render their background and ink token pairing", async ({
    page,
  }) => {
    await openCardList(page);

    const confirmed = page.locator(".badge-confirmed").first();
    const unverified = page.locator(".badge-needs-verification").first();
    // The frozen dataset carries both verification states; the unfiltered
    // result set renders both badges, and their presence is part of the
    // proof that the pairing assertion covers real rendered badges.
    await expect(confirmed).toBeVisible();
    await expect(unverified).toBeVisible();

    await expectTokenColor(
      page,
      confirmed,
      "background-color",
      "--color-badge-confirmed-bg",
      "the confirmed badge paints its background token",
    );
    await expectTokenColor(
      page,
      confirmed,
      "color",
      "--color-badge-confirmed-ink",
      "the confirmed badge paints its ink token",
    );
    await expectTokenColor(
      page,
      unverified,
      "background-color",
      "--color-badge-unverified-bg",
      "the unverified badge paints its background token",
    );
    await expectTokenColor(
      page,
      unverified,
      "color",
      "--color-badge-unverified-ink",
      "the unverified badge paints its ink token",
    );
  });
});

test.describe("the map label composite", () => {
  // Desktop-pinned: the pixel proof machinery's geometry expectations are
  // calibrated to the desktop framing (same pinning as the shared map-label
  // spec); the CI matrix's phone project runs this with the desktop layout.
  test.use({ viewport: { width: 1280, height: 720 } });

  test("selecting a unit paints a label composite whose ink, bubble, border, and ring families stay coherent with the token-derived paints", async ({
    page,
  }) => {
    // The pixel machinery is calibrated to deviceScaleFactor 1 desktop
    // rasters: the phone project's scaled emulation (device pixel ratio
    // ~2.6) shifts and rescales the composite, so canvas proofs descope
    // there — the same policy the shared matrix config records for the
    // other desktop-canvas proofs.
    test.skip(
      test.info().project.name === "mobile-chromium",
      "canvas pixel proofs are calibrated to the desktop projects' deviceScaleFactor 1 rasters",
    );
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

    // The shared classifier: dark glyph ink inside the white bubble, the
    // bubble's gray border, and the highlight ring's orange fill — the
    // paint families the token-derived map paints must keep producing.
    const stats = await labelGeometry(page, withLabel, withoutLabel);
    expectLabelGeometry(stats);
    // The camera centered the pin, so the label composite must sit in the
    // canvas's central band — the diff is a localized label, not noise.
    // 2px rasterization tolerance: software renderers place the composite
    // within ~1px of the Chromium raster; the band is the invariant.
    const rasterTolerance = 2;
    expect(stats.bubbleBBox.minX).toBeGreaterThan(stats.width * 0.2 - rasterTolerance);
    expect(stats.bubbleBBox.maxX).toBeLessThan(stats.width * 0.8 + rasterTolerance);
    expect(stats.bubbleBBox.minY).toBeGreaterThan(stats.height * 0.2 - rasterTolerance);
    expect(stats.inkBBox.maxY).toBeLessThan(stats.height * 0.8 + rasterTolerance);
  });
});
