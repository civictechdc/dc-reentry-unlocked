import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

/**
 * Rot-guard for the executable architecture rules: a dependency-cruiser
 * rule whose match set is empty guards nothing and is never reported —
 * the seam disarms silently. These tests assert the dataset-seam rule's
 * `from` and `to` patterns still match real files in the tree, so the
 * next rename fails loudly here instead of silently passing arch:check.
 * The patterns are never re-declared: .dependency-cruiser.cjs stays the
 * single source of truth.
 */

const depcruiseConfig = require("../.dependency-cruiser.cjs");
const datasetSeamRule = depcruiseConfig.forbidden.find(
  (rule) => rule.name === "api-route-must-not-read-dataset-directly",
);

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Walks a directory recursively, yielding cwd-relative forward-slash paths. */
function walkFiles(directory, root = repoRoot) {
  const found = [];
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const relative = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...walkFiles(relative, root));
    } else {
      found.push(relative);
    }
  }
  return found;
}

/** Compiles a rule pattern that may be a string or an array of strings. */
function compilePattern(pattern) {
  return Array.isArray(pattern)
    ? pattern.map((source) => new RegExp(source))
    : [new RegExp(pattern)];
}

/** The failure names the stale pattern and every file actually seen. */
function assertMatchesSomeFile(regexes, files, side) {
  const matched = files.filter((file) => regexes.some((regex) => regex.test(file)));
  expect(
    matched.length,
    [
      `the ${side} pattern of api-route-must-not-read-dataset-directly matches no real file — the seam is disarmed`,
      `pattern: ${JSON.stringify(side === "to" ? datasetSeamRule.to.path : datasetSeamRule.from.path)}`,
      `files seen: ${files.join(", ")}`,
    ].join("\n"),
  ).toBeGreaterThan(0);
}

describe("dataset seam arch rule", () => {
  test("the dataset seam rule still matches a real file under data/", () => {
    assertMatchesSomeFile(compilePattern(datasetSeamRule.to.path), walkFiles("data"), "to");
  });

  test("the dataset seam rule still targets at least one real file under apps/api/", () => {
    assertMatchesSomeFile(compilePattern(datasetSeamRule.from.path), walkFiles("apps/api"), "from");
  });

  test("the DataSource module stays exempt from the dataset seam rule", () => {
    const exemptions = compilePattern(datasetSeamRule.from.pathNot);
    expect(exemptions.some((regex) => regex.test("apps/api/src/datasource.ts"))).toBe(true);
  });
});
