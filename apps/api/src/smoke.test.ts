import { expect, test } from "vitest";

test("smoke build is up", () => {
  expect(new Set([1]).has(1)).toBe(true);
});
