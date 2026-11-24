export interface ChipsOverflow {
  /** Chips that fit fully inside the row and stay rendered as-is. */
  visibleCount: number;
  /** Chips beyond the row's clip edge (listed in the overflow popover). */
  hiddenCount: number;
}

/**
 * Partition chips for the bounded one-row presentation: a chip is fully
 * visible only when its right edge (left-anchored cumulative widths plus
 * the flex gap per preceding chip) does not pass the row's clip width.
 * When any chip overflows, the disclosure trigger must fit beside the last
 * visible chip, so a second pass re-runs with the trigger's space reserved
 * — chips that only fit without the trigger count as hidden.
 *
 * Pure so the measurement wiring (DOM rects, ResizeObserver) stays out of
 * the math and the boundary behavior stays unit-testable.
 */
export function chipsOverflow(
  widths: number[],
  gap: number,
  rowWidth: number,
  triggerReserve: number,
): ChipsOverflow {
  // Right edge of chip i in row coordinates, measured without the trigger:
  // a running width — each chip adds its width, each pair adds one gap.
  let running = 0;
  const rights = widths.map((width) => {
    running += width;
    const right = running;
    running += gap;
    return right;
  });
  const fittingWithin = (limit: number) => rights.filter((right) => right <= limit).length;

  const visibleWithoutTrigger = fittingWithin(rowWidth);
  if (visibleWithoutTrigger === widths.length) {
    return { visibleCount: widths.length, hiddenCount: 0 };
  }
  const visibleWithTrigger = fittingWithin(Math.max(0, rowWidth - triggerReserve));
  return {
    visibleCount: visibleWithTrigger,
    hiddenCount: widths.length - visibleWithTrigger,
  };
}
