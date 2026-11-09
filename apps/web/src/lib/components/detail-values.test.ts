import { describe, expect, test } from "vitest";
import { telHref } from "./detail-values.ts";

describe("telHref dialable links", () => {
  test("strips a formatted US number to its digits", () => {
    const href = telHref("(202) 555-0123");
    expect(href).toBe("tel:2025550123");
  });

  test("keeps a leading plus as the first character of the tel link", () => {
    const href = telHref("+1 202 555 0123");
    expect(href).toBe("tel:+12025550123");
  });

  test("drops pluses and separators that are not the leading character", () => {
    const href = telHref("202+555-0123");
    expect(href).toBe("tel:2025550123");
  });

  test("passes digits-only input through unchanged", () => {
    const href = telHref("2025550123");
    expect(href).toBe("tel:2025550123");
  });
});
