import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkExport, isGitTracked } from "../scripts/export-tokens.mjs";

/**
 * The export verification gate must fail closed on every tampered state of
 * the committed token stylesheet — hand-edited, deleted, or untracked —
 * and pass only on a tracked byte-identical artifact. The decision is a
 * pure function here; one real git fixture proves the tracked predicate.
 */

const FRESH = Buffer.from(":root {\n  --color-accent: #0b5fab;\n}\n");

describe("the generated-artifact export check (pure decision)", () => {
  test("a tracked byte-identical artifact passes", () => {
    const verdict = checkExport({
      freshContent: FRESH,
      committedContent: Buffer.from(FRESH),
      tracked: true,
    });
    expect(verdict.ok).toBe(true);
  });

  test("a hand-edited artifact fails and names the regeneration fix", () => {
    const verdict = checkExport({
      freshContent: FRESH,
      committedContent: Buffer.from(FRESH.toString().replace("#0b5fab", "#ff0000")),
      tracked: true,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/differs from a fresh export.*never hand-edit/s);
  });

  test("a deleted (tracked but absent) artifact fails", () => {
    const verdict = checkExport({ freshContent: FRESH, committedContent: null, tracked: true });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/tracked but missing on disk/s);
  });

  test("an untracked artifact fails before content is even compared", () => {
    const verdict = checkExport({ freshContent: FRESH, committedContent: null, tracked: false });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/no git index entry/s);
  });
});

describe("the tracked predicate over a real git fixture", () => {
  test("intent-to-add registers a path while an untracked sibling stays unregistered", () => {
    const repo = mkdtempSync(join(tmpdir(), "export-tracked-"));
    writeFileSync(join(repo, "tracked.css"), "a {}\n");
    writeFileSync(join(repo, "stray.css"), "b {}\n");
    try {
      const init = spawnSync("git", ["init", "-q"], { cwd: repo, encoding: "utf8" });
      expect(init.status).toBe(0);
      const addN = spawnSync("git", ["add", "-N", "tracked.css"], { cwd: repo, encoding: "utf8" });
      expect(addN.status).toBe(0);
      expect(isGitTracked("tracked.css", repo)).toBe(true);
      expect(isGitTracked("stray.css", repo)).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
