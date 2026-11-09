import { describe, expect, test } from "vitest";
import { stripFlagGuardedBlocksPreprocessor, stripGuardedFlagBlocks } from "./strip-guarded-blocks";

/** The real MapView guard text, with sample inner markup standing in for the control. */
const MAP_VIEW_ZOOM_GUARD_SOURCE = [
  '<div class="map-camera-controls">',
  '  {#if __FLAG_W1_MAP_ZOOM__ || (__DEV_SERVER__ && hasFlagOverride("w1-map-zoom"))}',
  '    <button type="button" data-flag="w1-map-zoom">+</button>',
  "  {/if}",
  "</div>",
].join("\n");

describe("stripping flag-guarded markup blocks", () => {
  test("strips a blessed-guard if block together with its inner markup and identifiers", () => {
    const stripped = stripGuardedFlagBlocks(MAP_VIEW_ZOOM_GUARD_SOURCE, "MapView.svelte");

    expect(stripped).not.toContain("data-flag=");
    expect(stripped).not.toContain("w1-map-zoom");
    expect(stripped).not.toContain("__FLAG_W1_MAP_ZOOM__");
    expect(stripped).not.toContain("__DEV_SERVER__");
    expect(stripped).toContain('<div class="map-camera-controls">');
  });

  test("leaves an if block that only references the dev-server marker untouched", () => {
    const source = ["{#if __DEV_SERVER__}", "  <p>dev only</p>", "{/if}"].join("\n");

    // Stripping keys on flag defines only — a `__DEV_SERVER__`-only guard is
    // not the blessed shape, but it is JS-side elimination's job, not this
    // preprocessor's.
    expect(stripGuardedFlagBlocks(source)).toBe(source);
  });

  test("keeps unguarded if blocks and normal markup byte-identical", () => {
    const source = [
      "<ul>",
      "  {#if units.length > 0}",
      "    <li>{units[0].address}</li>",
      "  {:else}",
      "    <li>none</li>",
      "  {/if}",
      "</ul>",
    ].join("\n");

    expect(stripGuardedFlagBlocks(source)).toBe(source);
  });

  test("strips the whole outer block when a guarded block nests inside another guarded block", () => {
    const source = [
      "{#if __FLAG_W1_MAP_ZOOM__}",
      "  outer",
      "  {#if __FLAG_W2_RECENTER__}",
      "    inner",
      "  {/if}",
      "{/if}",
    ].join("\n");
    const stripped = stripGuardedFlagBlocks(source);

    expect(stripped).not.toContain("outer");
    expect(stripped).not.toContain("inner");
    expect(stripped).not.toContain("__FLAG_W1_MAP_ZOOM__");
    expect(stripped).not.toContain("__FLAG_W2_RECENTER__");
  });

  test("strips a bare flag identifier guard", () => {
    const source = [
      "{#if __FLAG_W2_RECENTER__}",
      '  <button type="button">r</button>',
      "{/if}",
    ].join("\n");
    const stripped = stripGuardedFlagBlocks(source, "MapView.svelte");

    expect(stripped).not.toContain("__FLAG_W2_RECENTER__");
    expect(stripped).not.toContain("<button");
  });

  test("throws on a negated flag guard whose production semantics would render", () => {
    const source = "{#if !__FLAG_W1_MAP_ZOOM__}<p>only when zoomed off</p>{/if}";

    // Production folds the define to false, so `!__FLAG_…__` renders —
    // deleting the block would silently change what users see.
    expect(() => stripGuardedFlagBlocks(source, "MapView.svelte")).toThrow(/!__FLAG_W1_MAP_ZOOM__/);
    expect(() => stripGuardedFlagBlocks(source, "MapView.svelte")).toThrow(/blessed shape/);
  });

  test("throws on a mixed disjunction that references a flag define", () => {
    const source = "{#if units.length > 0 || __FLAG_W2_RECENTER__}<p>r</p>{/if}";

    expect(() => stripGuardedFlagBlocks(source, "MapView.svelte")).toThrow(
      /units\.length > 0 \|\| __FLAG_W2_RECENTER__/,
    );
    expect(() => stripGuardedFlagBlocks(source, "MapView.svelte")).toThrow(/blessed shape/);
  });

  test("throws on a guarded if block that has an else branch", () => {
    const source = "{#if __FLAG_W1_MAP_ZOOM__}<button>+</button>{:else}<span>none</span>{/if}";

    expect(() => stripGuardedFlagBlocks(source, "MapView.svelte")).toThrow(/__FLAG_W1_MAP_ZOOM__/);
  });

  test("throws on a guarded else-if branch", () => {
    const source =
      "{#if zoomed}<button>+</button>{:else if __FLAG_W2_RECENTER__}<span>r</span>{/if}";

    expect(() => stripGuardedFlagBlocks(source, "MapView.svelte")).toThrow(/W2_RECENTER/);
  });

  test("leaves source with no guards byte-identical", () => {
    const source = '<div class="map-canvas"></div>\n<section aria-label="map">pins</section>\n';

    expect(stripGuardedFlagBlocks(source)).toBe(source);
  });
});

describe("the strip preprocessor", () => {
  test("returns stripped markup from its markup hook — the hook vite builds compile through", () => {
    const processed = stripFlagGuardedBlocksPreprocessor.markup?.({
      content: MAP_VIEW_ZOOM_GUARD_SOURCE,
      filename: "MapView.svelte",
    });
    if (!processed || !("code" in processed) || typeof processed.code !== "string") {
      throw new Error("expected the markup hook to return processed code synchronously");
    }

    expect(processed.code).not.toContain("data-flag=");
    expect(processed.code).toContain('<div class="map-camera-controls">');
  });
});
