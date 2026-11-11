import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  basePinLayerPaint,
  highlightPinLayerPaint,
  pinLabelBubbleImage,
  pinLabelLayerDefinition,
} from "#lib/map/map-config.ts";

/**
 * Blocking WCAG 2.x token-pair contract over the role/state/adjacency
 * matrix: body and muted ink on every used surface, on-accent text in each
 * action state, verification badges, the map address-label, action tokens
 * consumed as ink (the camera-control hover glyph), focus rings,
 * the selection outline, and essential control/pin boundaries. Thresholds
 * compare unrounded: normal text >= 4.5:1, large text >= 3:1 only with
 * explicit size/weight evidence, essential non-text >= 3:1 against the
 * colors the boundary actually draws across. Decorative hairlines, the
 * label bubble's soft bitmap border, and adjacency to arbitrary raster
 * map tiles are documented exclusions, never silent waivers.
 */

// Vitest runs each workspace with the workspace root as cwd; import.meta.url
// is not file-scheme under the jsdom environment.
const GENERATED_TOKENS = join(process.cwd(), "src", "generated", "design-tokens.css");

const NORMAL_TEXT = 4.5;
const LARGE_TEXT = 3.0;
const NON_TEXT = 3.0;

/**
 * Every measured color must be an opaque 6-digit sRGB hex token. Shorthand
 * and alpha hex would otherwise parse to NaN (silently "passing" every
 * threshold, since NaN comparisons are false) or measure a transparent
 * color as opaque — both fail loudly here instead.
 */
export function assertOpaqueHex(hex: string, label: string): void {
  if (!/^#[0-9a-f]{6}$/.test(hex.toLowerCase())) {
    throw new Error(
      `${label}: "${hex}" is not an opaque 6-digit sRGB hex color (shorthand, alpha, and non-hex values are rejected)`,
    );
  }
}

/** WCAG 2.x relative luminance of an opaque sRGB hex color (exact math). */
function luminance(hex: string): number {
  const linear = (index: number): number => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

export function contrastRatio(
  foregroundHex: string,
  backgroundHex: string,
  label = "pair",
): number {
  assertOpaqueHex(foregroundHex, `${label} foreground`);
  assertOpaqueHex(backgroundHex, `${label} background`);
  const a = luminance(foregroundHex);
  const b = luminance(backgroundHex);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  if (!Number.isFinite(ratio)) {
    throw new Error(
      `${label}: contrast ratio is not finite (${foregroundHex} on ${backgroundHex})`,
    );
  }
  return ratio;
}

/**
 * Measures a matrix, returning a failure line for every pair that is below
 * its threshold or cannot be measured at all — a bad value fails its row
 * with the role named, never silently passes.
 */
export function matrixFailures(pairs: MatrixPair[]): string[] {
  const failures: string[] = [];
  for (const pair of pairs) {
    const label = `${pair.role} ${pair.state}`;
    try {
      const ratio = contrastRatio(pair.foreground, pair.background, label);
      if (!Number.isFinite(ratio) || ratio < pair.threshold) {
        failures.push(
          `${label}: ${pair.foreground} on ${pair.background} = ` +
            `${Number.isFinite(ratio) ? ratio.toFixed(4) : "non-finite"}:1, needs ${pair.threshold}:1`,
        );
      }
    } catch (error) {
      failures.push(`${label}: ${(error as Error).message}`);
    }
  }
  return failures;
}

/** The committed generated stylesheet: resolved literal hex per token name. */
function generatedColors(): Record<string, string> {
  if (!existsSync(GENERATED_TOKENS)) {
    throw new Error(
      `generated token stylesheet missing at ${GENERATED_TOKENS} — run pnpm -C apps/web design:export`,
    );
  }
  const css = readFileSync(GENERATED_TOKENS, "utf8");
  const colors: Record<string, string> = {};
  for (const match of css.matchAll(/^\s*--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8});$/gm)) {
    const name = match[1];
    const value = match[2];
    if (!name || !value) continue;
    colors[name] = value.toLowerCase();
  }
  return colors;
}

const COLORS = generatedColors();

/** Resolved token by name; missing or non-opaque-hex values fail naming the token. */
function token(name: string): string {
  const value = COLORS[name];
  if (!value)
    throw new Error(`--color-${name} missing from generated tokens — regenerate the artifact`);
  assertOpaqueHex(value, `--color-${name}`);
  return value;
}

function hexFromChannels(data: Uint8Array, offset: number, position: string): string {
  const bytes = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
  if (bytes.some((byte) => byte === undefined))
    throw new Error(`bubble pixel out of range at ${position}`);
  const alpha = bytes[3];
  if (alpha !== 255) {
    throw new Error(
      `label bubble sample at ${position} is not opaque: RGBA tuple [${bytes.join(", ")}] has alpha ${alpha} — ` +
        "a transparent map pixel must not measure as an opaque color",
    );
  }
  const hex = `#${bytes
    .slice(0, 3)
    .map((byte) => (byte as number).toString(16).padStart(2, "0"))
    .join("")}`;
  assertOpaqueHex(hex, "label bubble bitmap pixel");
  return hex;
}

function paintString(paint: unknown, key: string): string {
  const record =
    typeof paint === "object" && paint !== null ? (paint as Record<string, unknown>) : {};
  const value = record[key];
  if (typeof value !== "string") throw new Error(`map paint "${key}" is not a string`);
  assertOpaqueHex(value, `map paint "${key}"`);
  return value;
}

const bubble = pinLabelBubbleImage();
const bubbleBodyPixel = hexFromChannels(
  bubble.data,
  (5 * bubble.width + Math.floor((bubble.width - 1) / 2)) * 4,
  "body center, row 5",
);
// top edge: inside the silhouette, always border
const bubbleBorderPixel = hexFromChannels(
  bubble.data,
  Math.floor((bubble.width - 1) / 2) * 4,
  "top edge center",
);
const mapLabelInk = paintString(pinLabelLayerDefinition([]).paint, "text-color");
const basePinFill = paintString(basePinLayerPaint(), "circle-color");
const basePinStroke = paintString(basePinLayerPaint(), "circle-stroke-color");
const highlightPinFill = paintString(highlightPinLayerPaint(), "circle-color");
const highlightPinStroke = paintString(highlightPinLayerPaint(), "circle-stroke-color");

/**
 * The map paints and bitmap channels must equal their resolved design
 * tokens: the drift checker pins the bridge constants to DESIGN.md and the
 * map consumes those constants, so these equality proofs close the chain
 * from token to rendered surface.
 */
function mapPaintDerivationFailures(): string[] {
  const checks: Array<[string, string, string]> = [
    ["base pin fill", basePinFill, token("pin-exact")],
    ["base pin stroke", basePinStroke, token("pin-ring")],
    ["highlight pin fill", highlightPinFill, token("pin-highlight")],
    ["highlight pin stroke", highlightPinStroke, token("pin-highlight-ring")],
    ["map label ink", mapLabelInk, token("pin-label-ink")],
  ];
  return checks
    .filter(([, painted, resolved]) => painted !== resolved)
    .map(([name, painted, resolved]) => `${name}: painted ${painted} but token is ${resolved}`);
}

interface MatrixPair {
  role: string;
  state: string;
  kind: "text" | "non-text";
  foreground: string;
  background: string;
  threshold: number;
  /** Required when a text pair claims LARGE_TEXT: size/weight evidence. */
  largeTextEvidence?: string;
}

/**
 * The complete set of role/state identifiers the matrix MUST cover — text
 * and non-text alike. The completeness guard compares the built matrix
 * against exactly this list, so deleting a row (for example the
 * available-pin boundary) or adding an unreviewed one fails instead of
 * passing silently. Extend this list deliberately when the matrix grows.
 */
export const EXPECTED_PAIR_IDS = [
  "text|body ink|rest on page surface",
  "text|body ink|rest on raised cards and controls",
  "text|body ink|rest on disclosure banner",
  "text|body ink|rest on selected tint",
  "text|muted ink|rest on page surface",
  "text|muted ink|rest on raised cards and controls",
  "text|muted ink|rest on disclosure banner",
  "text|muted ink|rest on selected tint",
  "text|on-accent ink|primary action at rest",
  "text|on-accent ink|primary action hovered",
  "text|on-accent ink|toggle selected",
  "text|camera control glyph|hover on raised control",
  "text|badge text|confirmed badge",
  "text|badge text|needs-verification badge",
  "text|map label text|over the opaque bubble body",
  "non-text|essential control boundary|control outline on raised fill",
  "non-text|essential control boundary|control outline on page surface",
  "non-text|selection outline|selected card outline on raised card",
  "non-text|selection outline|selected card outline across page gap",
  "non-text|selected toggle fill|accent fill against raised panel",
  "non-text|focus ring|ring on page surface",
  "non-text|focus ring|ring on raised cards and controls",
  "non-text|focus ring|ring over disclosure banner",
  "non-text|focus ring|ring over selected tint",
  "non-text|available pin boundary|white stroke against pin fill",
  "non-text|highlight pin boundary|white stroke against highlight fill",
];

const pairId = (pair: MatrixPair): string => `${pair.kind}|${pair.role}|${pair.state}`;

/**
 * Throws unless the built matrix is an EXACT multiset of the expected
 * ids: a missing row, an unknown row, AND a duplicated row each fail,
 * naming the id (and the multiplicity mismatch).
 */
export function assertMatrixComplete(pairs: MatrixPair[]): void {
  const expectedCounts = new Map<string, number>();
  for (const id of EXPECTED_PAIR_IDS) expectedCounts.set(id, (expectedCounts.get(id) ?? 0) + 1);
  const actualCounts = new Map<string, number>();
  for (const pair of pairs) {
    const id = pairId(pair);
    actualCounts.set(id, (actualCounts.get(id) ?? 0) + 1);
  }
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [id, expectedCount] of expectedCounts) {
    const actualCount = actualCounts.get(id) ?? 0;
    if (actualCount < expectedCount) {
      missing.push(`${id} (expected ×${expectedCount}, found ×${actualCount})`);
    } else if (actualCount > expectedCount) {
      extra.push(`${id} (expected ×${expectedCount}, found ×${actualCount})`);
    }
  }
  for (const [id, actualCount] of actualCounts) {
    if (!expectedCounts.has(id))
      extra.push(`${id} (not part of the expected pair set, found ×${actualCount})`);
  }
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `matrix does not match the expected pair set — missing: [${missing.join(", ") || "none"}], extra: [${extra.join(", ") || "none"}]`,
    );
  }
}

/** The explicit role/state/adjacency matrix over resolved tokens. */
function matrixPairs(): MatrixPair[] {
  return [
    // Body ink is legible on every surface the app paints.
    {
      role: "body ink",
      kind: "text",
      state: "rest on page surface",
      foreground: token("ink"),
      background: token("surface"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "body ink",
      kind: "text",
      state: "rest on raised cards and controls",
      foreground: token("ink"),
      background: token("surface-raised"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "body ink",
      kind: "text",
      state: "rest on disclosure banner",
      foreground: token("ink"),
      background: token("surface-warning"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "body ink",
      kind: "text",
      state: "rest on selected tint",
      foreground: token("ink"),
      background: token("surface-selected"),
      threshold: NORMAL_TEXT,
    },
    // Muted ink stays legible everywhere de-emphasis is applied.
    {
      role: "muted ink",
      kind: "text",
      state: "rest on page surface",
      foreground: token("ink-muted"),
      background: token("surface"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "muted ink",
      kind: "text",
      state: "rest on raised cards and controls",
      foreground: token("ink-muted"),
      background: token("surface-raised"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "muted ink",
      kind: "text",
      state: "rest on disclosure banner",
      foreground: token("ink-muted"),
      background: token("surface-warning"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "muted ink",
      kind: "text",
      state: "rest on selected tint",
      foreground: token("ink-muted"),
      background: token("surface-selected"),
      threshold: NORMAL_TEXT,
    },
    // On-accent text across the action states; focus keeps the accent fill
    // (the ring is the focused-state boundary and is asserted as non-text).
    {
      role: "on-accent ink",
      kind: "text",
      state: "primary action at rest",
      foreground: token("ink-on-accent"),
      background: token("accent"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "on-accent ink",
      kind: "text",
      state: "primary action hovered",
      foreground: token("ink-on-accent"),
      background: token("accent-hover"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "on-accent ink",
      kind: "text",
      state: "toggle selected",
      foreground: token("ink-on-accent"),
      background: token("accent"),
      threshold: NORMAL_TEXT,
    },
    // Action tokens also render as ink, not just as fills: the map
    // camera-control glyph recolors to accent-hover on hover while its own
    // raised fill stays put (the active state keeps ink on the selected
    // tint, already asserted above).
    {
      role: "camera control glyph",
      kind: "text",
      state: "hover on raised control",
      foreground: token("accent-hover"),
      background: token("surface-raised"),
      threshold: NORMAL_TEXT,
    },
    // Verification badges: 12px weight-600 text, asserted at the normal bar.
    {
      role: "badge text",
      kind: "text",
      state: "confirmed badge",
      foreground: token("badge-confirmed-ink"),
      background: token("badge-confirmed-bg"),
      threshold: NORMAL_TEXT,
    },
    {
      role: "badge text",
      kind: "text",
      state: "needs-verification badge",
      foreground: token("badge-unverified-ink"),
      background: token("badge-unverified-bg"),
      threshold: NORMAL_TEXT,
    },
    // The map address label on its opaque speech-bubble body — the resolved
    // pair, with the bitmap proven to paint exactly the body token below.
    {
      role: "map label text",
      kind: "text",
      state: "over the opaque bubble body",
      foreground: token("pin-label-ink"),
      background: token("pin-label-bg"),
      threshold: NORMAL_TEXT,
    },
    // Essential non-text boundaries against the colors they actually draw
    // across (the map pane frame and floating controls sit over raised or
    // page surfaces; their tile-side adjacency is not claimable).
    {
      role: "essential control boundary",
      kind: "non-text",
      state: "control outline on raised fill",
      foreground: token("line-strong"),
      background: token("surface-raised"),
      threshold: NON_TEXT,
    },
    {
      role: "essential control boundary",
      kind: "non-text",
      state: "control outline on page surface",
      foreground: token("line-strong"),
      background: token("surface"),
      threshold: NON_TEXT,
    },
    {
      role: "selection outline",
      kind: "non-text",
      state: "selected card outline on raised card",
      foreground: token("accent"),
      background: token("surface-raised"),
      threshold: NON_TEXT,
    },
    {
      role: "selection outline",
      kind: "non-text",
      state: "selected card outline across page gap",
      foreground: token("accent"),
      background: token("surface"),
      threshold: NON_TEXT,
    },
    {
      role: "selected toggle fill",
      kind: "non-text",
      state: "accent fill against raised panel",
      foreground: token("accent"),
      background: token("surface-raised"),
      threshold: NON_TEXT,
    },
    {
      role: "focus ring",
      kind: "non-text",
      state: "ring on page surface",
      foreground: token("accent-focus-ring"),
      background: token("surface"),
      threshold: NON_TEXT,
    },
    {
      role: "focus ring",
      kind: "non-text",
      state: "ring on raised cards and controls",
      foreground: token("accent-focus-ring"),
      background: token("surface-raised"),
      threshold: NON_TEXT,
    },
    {
      role: "focus ring",
      kind: "non-text",
      state: "ring over disclosure banner",
      foreground: token("accent-focus-ring"),
      background: token("surface-warning"),
      threshold: NON_TEXT,
    },
    {
      role: "focus ring",
      kind: "non-text",
      state: "ring over selected tint",
      foreground: token("accent-focus-ring"),
      background: token("surface-selected"),
      threshold: NON_TEXT,
    },
    // Pin strokes separate data pins from their own fill (the tile side is
    // not claimable against arbitrary raster imagery).
    {
      role: "available pin boundary",
      kind: "non-text",
      state: "white stroke against pin fill",
      foreground: token("pin-ring"),
      background: token("pin-exact"),
      threshold: NON_TEXT,
    },
    {
      role: "highlight pin boundary",
      kind: "non-text",
      state: "white stroke against highlight fill",
      foreground: token("pin-highlight-ring"),
      background: token("pin-highlight"),
      threshold: NON_TEXT,
    },
  ];
}

describe("the WCAG token-pair contract over resolved design tokens", () => {
  test("the generated stylesheet exposes every token the matrix consumes", () => {
    const required = [
      "ink",
      "ink-muted",
      "ink-on-accent",
      "surface",
      "surface-raised",
      "surface-warning",
      "surface-selected",
      "accent",
      "accent-hover",
      "accent-focus-ring",
      "line-strong",
      "badge-confirmed-ink",
      "badge-confirmed-bg",
      "badge-unverified-ink",
      "badge-unverified-bg",
      "pin-exact",
      "pin-highlight",
      "pin-ring",
      "pin-highlight-ring",
      "pin-label-ink",
      "pin-label-bg",
      "pin-label-border",
    ];
    expect(() => required.forEach(token)).not.toThrow();
  });

  test("the map layer paints carry exactly the resolved pin tokens the bridges pin", () => {
    expect(mapPaintDerivationFailures()).toEqual([]);
  });

  test("the label bubble bitmap really paints the body color the label token names", () => {
    expect(bubbleBodyPixel).toBe(token("pin-label-bg"));
  });

  test("every sampled bitmap position is verified opaque before its color is measured", () => {
    // The production samples carry alpha 255 by construction of the bitmap;
    // the guard in hexFromChannels rejects anything else, proven here with
    // a stub whose sampled pixel is transparent.
    const transparent = new Uint8Array([255, 255, 255, 0]);
    expect(() => hexFromChannels(transparent, 0, "stub body center")).toThrow(
      /stub body center.*alpha 0/,
    );
    const translucent = new Uint8Array([255, 255, 255, 254]);
    expect(() => hexFromChannels(translucent, 0, "stub top edge")).toThrow(
      /stub top edge.*\[255, 255, 255, 254\].*alpha 254/,
    );
  });

  test("the bubble's soft bitmap border stays decorative and is never a claimed boundary", () => {
    // Documented exclusion: the bubble border identifies nothing essential —
    // the opaque body separates the label from the map, so the text pair
    // above carries the requirement.
    expect(bubbleBorderPixel.toLowerCase()).toBe(token("pin-label-border"));
    expect(contrastRatio(bubbleBorderPixel, token("pin-label-bg"))).toBeLessThan(NON_TEXT);
  });

  test("every pair in the role/state/adjacency matrix meets its threshold", () => {
    expect(matrixFailures(matrixPairs()), "failing matrix pairs").toEqual([]);
  });

  test("every large-text claim carries explicit size or weight evidence", () => {
    const unevidenced = matrixPairs().filter(
      (pair) => pair.kind === "text" && pair.threshold === LARGE_TEXT && !pair.largeTextEvidence,
    );
    // No current text relies on the large-text allowance; the day one does,
    // it must carry >=18pt regular or >=14pt bold evidence in the matrix.
    expect(unevidenced, "large-text thresholds require evidence").toEqual([]);
  });

  test("the corrected essential boundary keeps its margin on both adjacencies", () => {
    // line-strong was darkened at inventory time because #8a97a0 measured
    // below 3:1 against its fill; the correction must hold on both sides.
    expect(contrastRatio(token("line-strong"), token("surface-raised"))).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
    expect(contrastRatio(token("line-strong"), token("surface"))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  test("normal text thresholds are never quietly relaxed to the large-text bar", () => {
    const textPairs = matrixPairs().filter((pair) => pair.kind === "text");
    expect(textPairs.length).toBeGreaterThanOrEqual(14);
    for (const pair of textPairs) {
      expect(pair.threshold).toBe(NORMAL_TEXT);
    }
  });

  test("a shorthand hex color is rejected instead of measuring NaN and silently passing", () => {
    expect(() => assertOpaqueHex("#0b5", "test token")).toThrow(
      /test token.*"#0b5".*not an opaque 6-digit/,
    );
    // end to end: the NaN path could never fail a threshold comparison
    expect(() => contrastRatio("#abc", "#ffffff", "shorthand")).toThrow(/shorthand foreground/);
  });

  test("an alpha (8-digit) hex color is rejected instead of measuring transparent as opaque", () => {
    // #1b2a3400 (fully transparent body ink) used to "measure" ~14.7:1
    // against white because alpha was ignored
    expect(() => assertOpaqueHex("#1b2a3400", "test token")).toThrow(
      /test token.*"#1b2a3400".*not an opaque 6-digit/,
    );
    expect(() => contrastRatio("#1b2a3400", "#ffffff", "alpha")).toThrow(/alpha foreground/);
  });

  test("a pair that cannot be measured fails its row naming the role, never passing silently", () => {
    const failures = matrixFailures([
      {
        role: "invented role",
        state: "over a bad value",
        kind: "text",
        foreground: "#nothex",
        background: "#ffffff",
        threshold: NORMAL_TEXT,
      },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/invented role over a bad value.*not an opaque 6-digit/s);
  });

  test("the built matrix covers exactly the expected role/state set for both kinds", () => {
    expect(() => assertMatrixComplete(matrixPairs())).not.toThrow();
  });

  test("removing a non-text matrix row fails the completeness guard", () => {
    const trimmed = matrixPairs().filter((pair) => pair.role !== "available pin boundary");
    expect(() => assertMatrixComplete(trimmed)).toThrow(
      /missing: \[non-text\|available pin boundary\|white stroke against pin fill \(expected ×1, found ×0\)\]/,
    );
  });

  test("an unreviewed extra matrix row fails the completeness guard", () => {
    const extraRow: MatrixPair = {
      role: "unreviewed role",
      state: "sneaked in",
      kind: "non-text",
      foreground: "#000000",
      background: "#ffffff",
      threshold: NON_TEXT,
    };
    const padded: MatrixPair[] = [...matrixPairs(), extraRow];
    expect(() => assertMatrixComplete(padded)).toThrow(
      /extra: \[non-text\|unreviewed role\|sneaked in \(not part of the expected pair set, found ×1\)\]/,
    );
  });

  test("duplicating a text matrix row fails the completeness guard on multiplicity", () => {
    const rows = matrixPairs();
    const duplicated: MatrixPair[] = [...rows, rows[0]!];
    expect(() => assertMatrixComplete(duplicated)).toThrow(
      /extra: \[text\|body ink\|rest on page surface \(expected ×1, found ×2\)\]/,
    );
  });

  test("duplicating a non-text matrix row fails the completeness guard too", () => {
    const rows = matrixPairs();
    const pinRow = rows.find((pair) => pair.role === "available pin boundary")!;
    const duplicated: MatrixPair[] = [...rows, pinRow];
    expect(() => assertMatrixComplete(duplicated)).toThrow(
      /extra: \[non-text\|available pin boundary\|white stroke against pin fill \(expected ×1, found ×2\)\]/,
    );
  });

  test("removing a text matrix row fails the completeness guard", () => {
    const trimmed = matrixPairs().filter(
      (pair) => !(pair.role === "muted ink" && pair.state === "rest on page surface"),
    );
    expect(() => assertMatrixComplete(trimmed)).toThrow(
      /missing: \[text\|muted ink\|rest on page surface \(expected ×1, found ×0\)\]/,
    );
  });
});
