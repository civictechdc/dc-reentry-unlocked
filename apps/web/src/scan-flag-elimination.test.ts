import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  collectFiles,
  DATA_FLAG_NEEDLE,
  FLAG_IDENTIFIER_NEEDLES,
  findNeedleHits,
  scanTree,
} from "../scripts/scan-flag-elimination.mjs";

describe("the flag-elimination scan over a fixture tree", () => {
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "flag-elimination-scan-fixture-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("a clean fixture tree yields no identifier or marker hits", () => {
    mkdirSync(join(fixtureRoot, "assets"), { recursive: true });
    writeFileSync(join(fixtureRoot, "index.html"), "<main><p>units near you</p></main>\n");
    writeFileSync(join(fixtureRoot, "assets", "app.js"), 'console.log("units loaded");\n');

    const result = scanTree(fixtureRoot);

    expect(collectFiles(fixtureRoot)).toHaveLength(2);
    expect(result.scannedFiles).toBe(2);
    expect(result.identifierHits).toHaveLength(0);
    expect(result.markerHits).toHaveLength(0);
  });

  test("a seeded data-flag marker is reported with its file, line, and column", () => {
    const leaked = ["<div>", '  <button data-flag="w1-map-zoom">+</button>', "</div>", ""].join(
      "\n",
    );
    writeFileSync(join(fixtureRoot, "leaked.html"), leaked);
    const markerLine = leaked.split("\n")[1] ?? "";

    const result = scanTree(fixtureRoot);

    expect(result.markerHits).toHaveLength(1);
    const hit = result.markerHits[0];
    expect(hit?.needle).toBe(DATA_FLAG_NEEDLE);
    expect(hit?.file).toBe(join(fixtureRoot, "leaked.html"));
    expect(hit?.line).toBe(2);
    expect(hit?.column).toBe(markerLine.indexOf(DATA_FLAG_NEEDLE) + 1);
  });

  test("a surviving __FLAG_ identifier is reported as a hit", () => {
    writeFileSync(join(fixtureRoot, "survivor.js"), "if (__FLAG_W9_EXAMPLE__) enableZoom();\n");
    writeFileSync(join(fixtureRoot, "devmarker.js"), "const dev = __DEV_SERVER__;\n");

    const result = scanTree(fixtureRoot);

    expect(result.identifierHits).toHaveLength(2);
    expect(result.identifierHits.map((hit) => hit.needle).sort()).toEqual(
      [...FLAG_IDENTIFIER_NEEDLES].sort(),
    );
    const flagHit = findNeedleHits("if (__FLAG_W9_EXAMPLE__) enableZoom();", ["__FLAG_"]);
    expect(flagHit).toHaveLength(1);
    expect(flagHit[0]?.line).toBe(1);
    expect(flagHit[0]?.column).toBe("if (".length + 1);
    expect(result.identifierHits.every((hit) => hit.snippet.length > 0)).toBe(true);

    // Content-derived snippet text never carries raw control characters: an
    // escape byte in build output cannot forge a terminal or log line.
    const escapeByte = String.fromCharCode(27);
    const forged = findNeedleHits(`const x = "${escapeByte}[31m__FLAG_W9_EXAMPLE__";`, ["__FLAG_"]);
    expect(forged[0]?.snippet).not.toContain(escapeByte);
    expect(forged[0]?.snippet).toContain("\\u001b");
  });
});
