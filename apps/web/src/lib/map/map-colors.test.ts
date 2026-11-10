import { describe, expect, test } from "vitest";
import {
  PIN_EXACT,
  PIN_HIGHLIGHT,
  PIN_HIGHLIGHT_RING,
  PIN_LABEL_BG,
  PIN_LABEL_BORDER,
  PIN_LABEL_INK,
  PIN_RING,
  rgbChannels,
} from "./map-colors.ts";

describe("the named map color constants", () => {
  test("each map color carries its frozen status value", () => {
    expect(PIN_EXACT).toBe("#0b5fab");
    expect(PIN_HIGHLIGHT).toBe("#d9340f");
    expect(PIN_RING).toBe("#ffffff");
    expect(PIN_HIGHLIGHT_RING).toBe("#ffffff");
    expect(PIN_LABEL_INK).toBe("#1f2937");
    expect(PIN_LABEL_BG).toBe("#ffffff");
    expect(PIN_LABEL_BORDER).toBe("#cccccc");
  });
});

describe("rgbChannels derives the sRGB channels of an opaque hex color", () => {
  test.each([
    ["#ffffff", [255, 255, 255]],
    ["#cccccc", [204, 204, 204]],
    ["#1f2937", [31, 41, 55]],
    ["#0b5fab", [11, 95, 171]],
    ["#d9340f", [217, 52, 15]],
  ])("channels of %s are %j", (hex, channels) => {
    expect(rgbChannels(hex)).toEqual(channels);
  });

  test("a shorthand, alpha, or non-hex value throws instead of writing wrong channels", () => {
    expect(() => rgbChannels("#fff")).toThrow(/not an opaque 6-digit sRGB hex color/);
    expect(() => rgbChannels("#1f293700")).toThrow(/not an opaque 6-digit sRGB hex color/);
    expect(() => rgbChannels("1f2937")).toThrow(/not an opaque 6-digit sRGB hex color/);
    expect(() => rgbChannels("#nothex")).toThrow(/not an opaque 6-digit sRGB hex color/);
  });
});
