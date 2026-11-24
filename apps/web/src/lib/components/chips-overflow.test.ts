import { describe, expect, test } from "vitest";
import { chipsOverflow } from "./chips-overflow.ts";

describe("bounded chip row partition", () => {
  test("keeps every chip visible when all right edges fit the row", () => {
    // 3 chips of 100px, 8px gaps: rights 100, 208, 316 — all inside 400px.
    const result = chipsOverflow([100, 100, 100], 8, 400, 80);
    expect(result).toEqual({ visibleCount: 3, hiddenCount: 0 });
  });

  test("hides only the chips whose right edge passes the row width", () => {
    // rights 100, 208, 316, 424 — the fourth chip overflows a 400px row.
    const result = chipsOverflow([100, 100, 100, 100], 8, 400, 80);
    expect(result).toEqual({ visibleCount: 3, hiddenCount: 1 });
  });

  test("counts a chip ending exactly at the row edge as visible", () => {
    const result = chipsOverflow([150, 250], 0, 400, 80);
    expect(result).toEqual({ visibleCount: 2, hiddenCount: 0 });
  });

  test("reserves the trigger's space so it fits beside the last visible chip", () => {
    // Rights 100, 208, 316, 424: a 400px row plainly fits three chips and
    // overflows on the fourth; with 88px reserved for the trigger the limit
    // drops to 312px, so the third chip hides too and the trigger fits
    // beside the second. (When everything fits plainly there is no overflow
    // and no trigger, so the reservation never applies.)
    const result = chipsOverflow([100, 100, 100, 100], 8, 400, 88);
    expect(result).toEqual({ visibleCount: 2, hiddenCount: 2 });
  });

  test("keeps every chip visible when they all fit even beside the trigger", () => {
    // Rights up to 316 with the trigger reserved: nothing hides.
    const result = chipsOverflow([100, 100, 100], 8, 400, 88);
    expect(result).toEqual({ visibleCount: 3, hiddenCount: 0 });
  });

  test("accumulates the gap across chips when computing right edges", () => {
    // rights: 60, 60+12+70=142, 142+12+90=244 — the third chip overflows 240px.
    const result = chipsOverflow([60, 70, 90], 12, 240, 80);
    expect(result).toEqual({ visibleCount: 2, hiddenCount: 1 });
  });

  test("hides everything when no chip fits beside the trigger", () => {
    const result = chipsOverflow([500, 500], 8, 400, 80);
    expect(result).toEqual({ visibleCount: 0, hiddenCount: 2 });
  });

  test("partitions nothing for an empty row", () => {
    expect(chipsOverflow([], 8, 400, 80)).toEqual({ visibleCount: 0, hiddenCount: 0 });
  });

  test("keeps the reservation from driving a negative clip width", () => {
    // A chip wider than the row overflows outright; with the row narrower
    // than the reservation the limit floors at zero and everything hides.
    const result = chipsOverflow([70], 8, 60, 88);
    expect(result).toEqual({ visibleCount: 0, hiddenCount: 1 });
  });
});
