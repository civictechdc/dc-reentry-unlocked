/**
 * Named map paint colors — the DESIGN.md status/map color tokens consumed
 * outside CSS. MapLibre style JSON and the typed-array label-bubble bitmap
 * cannot read CSS custom properties, so these constants carry the values;
 * the design drift checker bridges every constant back to its resolved
 * DESIGN.md color, so a token edit that skips this module fails the drift
 * check instead of rendering stale paint. One constant per token: equal
 * values stay separate names, because status paints are deliberately
 * unaliased — equal hex is coincidence, never a shared brand reference.
 */

/** Available unit's pin fill (`colors.pin-exact`). */
export const PIN_EXACT = "#0b5fab";

/** Selected/hovered pin fill (`colors.pin-highlight`). */
export const PIN_HIGHLIGHT = "#d9340f";

/** Base pin's separating stroke (`colors.pin-ring`). */
export const PIN_RING = "#ffffff";

/** Highlight pin's separating stroke (`colors.pin-highlight-ring`). */
export const PIN_HIGHLIGHT_RING = "#ffffff";

/** Map address-label text on the bubble (`colors.pin-label-ink`). */
export const PIN_LABEL_INK = "#1f2937";

/** Label bubble body the address text sits on (`colors.pin-label-bg`). */
export const PIN_LABEL_BG = "#ffffff";

/** Label bubble's soft bitmap border (`colors.pin-label-border`). */
export const PIN_LABEL_BORDER = "#cccccc";

/**
 * The sRGB `[r, g, b]` channels of an opaque 6-digit hex color, for
 * typed-array pixel writes that assign one channel per index. Anything but
 * `#rrggbb` throws — a shorthand or alpha hex would silently write wrong
 * channels instead of failing loudly.
 */
export function rgbChannels(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/.test(hex.toLowerCase())) {
    throw new Error(`"${hex}" is not an opaque 6-digit sRGB hex color`);
  }
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}
