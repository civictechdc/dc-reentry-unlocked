import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PHONE_QUERY } from "#lib/state/viewport.svelte.ts";

/**
 * Structural pins for the desktop layout's proportion rules. jsdom does not
 * compute layout, so these tests pin the CSS rules themselves (the scoped
 * style blocks inside the Svelte sources) rather than computed boxes — the
 * live rendering is proven by the Playwright e2e suite against the dev
 * server.
 */
const libDir = import.meta.dirname;
const routeCss = readFileSync(join(libDir, "..", "..", "routes", "+page.svelte"), "utf8");
const mapCss = readFileSync(join(libDir, "..", "components", "MapView.svelte"), "utf8");
const cardListCss = readFileSync(join(libDir, "..", "components", "UnitCardList.svelte"), "utf8");
const detailCss = readFileSync(join(libDir, "..", "components", "DetailSlideOver.svelte"), "utf8");

/** Returns the declaration block of a flat `selector { ... }` rule. */
function ruleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const block = match?.[1];
  if (block === undefined) throw new Error(`rule not found: ${selector}`);
  return block.replace(/\s+/g, " ");
}

describe("the desktop grid proportions", () => {
  test("caps the desktop card list between 26rem and 32rem so the map column keeps room for its aspect cap", () => {
    const layout = ruleBlock(routeCss, ".desktop-layout");

    expect(layout).toContain("grid-template-columns: minmax(0, 1fr) minmax(26rem, 32rem)");
  });

  test("never regresses to the stretched first-column map strip", () => {
    expect(routeCss).not.toContain("minmax(22rem, 26rem)");
    expect(routeCss).not.toMatch(/grid-template-columns:\s*1fr\s/);
  });

  test("keeps the map pane's grid tracks shrinkable so the mounted canvas cannot size the pane", () => {
    const mapPane = ruleBlock(routeCss, ".map-pane");

    expect(mapPane).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(mapPane).toContain("grid-template-rows: minmax(0, 1fr)");
  });
});

describe("the desktop map pane", () => {
  test("height-binds the map so wide viewports center a map capped near 4:3 instead of a stretched strip", () => {
    const pane = ruleBlock(routeCss, ".map-pane");
    const paneScopedMap = ruleBlock(routeCss, ".map-pane :global(.map-view)");
    const mapView = ruleBlock(mapCss, ".map-view");

    expect(pane).toContain("container-type: size");
    expect(pane).toContain("justify-items: center");
    // The cap is pane-scoped: container units must resolve against the pane's
    // size container.
    expect(paneScopedMap).toContain("width: min(100%, calc(100cqh * 4 / 3))");
    // And it must stay out of the shared map component, whose phone map tab
    // has no size container (a leaked cap would narrow the phone map).
    expect(mapView).not.toContain("100cqh");
  });

  test("lets the map's own grid tracks shrink so the mounted canvas cannot pin the pane open", () => {
    const mapView = ruleBlock(mapCss, ".map-view");
    const mapCanvas = ruleBlock(mapCss, ".map-canvas");

    expect(mapView).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(mapView).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(mapCanvas).toContain("width: 100%");
  });

  test("clamps the map canvas to its grid row so short desktop viewports do not overflow it", () => {
    const mapCanvas = ruleBlock(mapCss, ".map-canvas");

    expect(mapCanvas).toContain("min-height: 0");
    expect(mapCanvas).toContain("height: 100%");
    expect(mapCanvas).not.toContain("24rem");
  });
});

describe("the desktop card list containment", () => {
  test("keeps the card stack's scroll inside its pane so the full stack cannot scroll the page", () => {
    const unitList = ruleBlock(cardListCss, ".unit-list");
    const listPane = ruleBlock(routeCss, ".list-pane");

    expect(unitList).toContain("overflow-y: auto");
    expect(unitList).toContain("contain: layout");
    // The pane's row must flex instead of sizing to the card stack — the
    // actual scroll boundary (containment alone does not bound the track).
    expect(listPane).toContain("grid-template-rows: minmax(0, 1fr)");
  });
});

describe("the detail slide-over breakpoint", () => {
  test("keeps the detail sheet phone-shaped below the 900px boundary so in-between widths are not a mixed layout", () => {
    expect(detailCss).toContain(`@media ${PHONE_QUERY}`);
    expect(detailCss).not.toContain("(max-width: 768px)");
  });

  test("carries exactly the viewport state's phone boundary so the sheet and the tabbed form switch together", () => {
    const mediaMatch = detailCss.match(/@media \(max-width: ([^)]+)\)/);
    const mediaQuery = mediaMatch?.[0];
    if (mediaQuery === undefined) throw new Error("no max-width media query in DetailSlideOver");

    expect(mediaQuery).toBe(`@media ${PHONE_QUERY}`);
  });
});

describe("the phone map tab", () => {
  test("square-caps the map in the map viewport and centers it so portrait phones get a width-bound square", () => {
    const mapActiveViewport = ruleBlock(routeCss, ":global(.phone.map-active) .mobile-viewport");
    const phoneMap = ruleBlock(
      routeCss,
      ":global(.phone.map-active) .mobile-viewport :global(.map-view)",
    );

    expect(mapActiveViewport).toContain("container-type: size");
    expect(phoneMap).toContain("width: min(100%, calc(100cqw - 1.5rem), calc(100cqh - 1.5rem))");
    expect(phoneMap).toContain("height: min(calc(100cqw - 1.5rem), calc(100cqh - 1.5rem))");
    expect(phoneMap).toContain("justify-self: center");
    expect(phoneMap).toContain("align-self: center");
  });

  test("floats the tab bar over the map only while the map tab is active so the list tab keeps the in-flow bar", () => {
    const floatingBar = ruleBlock(routeCss, ":global(.phone.map-active) .mobile-bar");
    const baseBarMatch = routeCss.match(/\n  \.mobile-bar \{([^}]*)\}/);
    const baseBar = baseBarMatch?.[1];
    if (baseBar === undefined) throw new Error("base .mobile-bar rule not found");

    expect(floatingBar).toContain("position: absolute");
    expect(baseBar).not.toContain("position:");
  });

  test("fills the height the floating bar vacates through the flex chain so no fixed height constant is needed", () => {
    const mapActiveShell = ruleBlock(routeCss, ":global(.phone.map-active)");

    expect(routeCss).toContain(":global(body:has(.phone.map-active))");
    expect(routeCss).toContain(":global(main:has(> .phone.map-active))");
    expect(mapActiveShell).toContain("flex: 1");
    expect(mapActiveShell).toContain("position: relative");
  });
});

describe("the map pane frame", () => {
  test("frames the map pane with a small border and radius wherever it renders", () => {
    const mapView = ruleBlock(mapCss, ".map-view");

    expect(mapView).toContain("border: 1px solid var(--line-strong)");
    expect(mapView).toContain("border-radius: var(--radius)");
    // The corner-clip mechanism: without it the square canvas corners poke
    // out of the rounded frame.
    expect(mapView).toContain("overflow: hidden");
  });

  test("releases the pin list's screen-hiding clip while a pin is focused so the focus bubble stays paintable and hittable", () => {
    const release = ruleBlock(mapCss, ".sr-pins:has(button:focus-visible)");

    expect(release).toContain("clip-path: none");
  });
});
