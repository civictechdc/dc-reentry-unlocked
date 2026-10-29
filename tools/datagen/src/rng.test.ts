import { expect, test } from "vitest";
import { fc } from "@fast-check/vitest";
import { chance, hashString, intInRange, mulberry32, pick, shuffle, weightedPick } from "./rng.ts";

test("a RNG stream is identical across runs with the same seed", () => {
  const first = mulberry32(20261029);
  const second = mulberry32(20261029);
  const a = Array.from({ length: 1000 }, () => first());
  const b = Array.from({ length: 1000 }, () => second());
  expect(a).toEqual(b);
});

test("different seeds diverge within the first draws", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  const stream = (rng: () => number) => Array.from({ length: 8 }, () => rng());
  expect(stream(a)).not.toEqual(stream(b));
});

test("integer draws always land inside the inclusive bounds", () => {
  expect(() =>
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 50 }),
        (seed, width) => {
          const rng = mulberry32(seed);
          const min = 3;
          const max = min + width;
          for (let i = 0; i < 50; i++) {
            const value = intInRange(rng, min, max);
            if (value < min || value > max) {
              return false;
            }
          }
          return true;
        },
      ),
    ),
  ).not.toThrow();
});

test("intInRange rejects an empty range instead of drawing", () => {
  expect(() => intInRange(mulberry32(1), 5, 4)).toThrow(/empty integer range/);
});

test("shuffle keeps every member and only reorders", () => {
  const shuffled = shuffle(mulberry32(11), [1, 2, 3, 4, 5]);
  expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
});

test("same seed shuffles identically", () => {
  expect(shuffle(mulberry32(11), [1, 2, 3, 4, 5])).toEqual(
    shuffle(mulberry32(11), [1, 2, 3, 4, 5]),
  );
});

test("weightedPick returns only values from the offered entries", () => {
  expect(() =>
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (seed) => {
        const rng = mulberry32(seed);
        for (let i = 0; i < 50; i++) {
          const value = weightedPick(rng, [
            ["x", 3],
            ["y", 1],
          ] as const);
          if (value !== "x" && value !== "y") {
            return false;
          }
        }
        return true;
      }),
    ),
  ).not.toThrow();
});

test("pick reads from a non-empty list and chance draws stay boolean-consistent", () => {
  const rng = mulberry32(77);
  expect(pick(rng, ["a", "b", "c"])).toMatch(/^[abc]$/);
  for (let i = 0; i < 20; i++) {
    expect(typeof chance(rng, 0.5)).toBe("boolean");
  }
});

test("hashString is stable for the same input", () => {
  expect(hashString("18TH ST|NW")).toBe(hashString("18TH ST|NW"));
  expect(hashString("18TH ST|NW")).not.toBe(hashString("19TH ST|NW"));
});
