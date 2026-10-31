import { afterEach, describe, expect, test } from "vitest";
import { assertCleanup, assertPreflightClean, dirtyTrackedFiles } from "./run-mutation.mjs";
import { assertHasDiagrams, parseMermaidBlocks } from "./check-diagrams.mjs";

/**
 * Gate-critical script behavior: the mermaid-block parser must never
 * silently drop content, and the mutation orchestrator must never run
 * destructive cleanup over pre-existing work. Unit-level (stubbed git) plus
 * one real-tree preflight probe that appends a scratch byte to a committed
 * file and restores it byte-exactly.
 */

describe("mermaid block parsing", () => {
  test("closed mermaid blocks parse in file order", () => {
    const md = [
      "intro",
      "```mermaid",
      "flowchart A --> B",
      "```",
      "",
      "```mermaid",
      "flowchart C --> D",
      "```",
    ].join("\n");
    expect(parseMermaidBlocks(md)).toEqual(["flowchart A --> B", "flowchart C --> D"]);
  });

  test("an unterminated mermaid fence fails the parse instead of vanishing", () => {
    const md = ["intro", "```mermaid", "flowchart A --> B"].join("\n"); // no closing fence
    expect(() => parseMermaidBlocks(md, "broken.md")).toThrow(/broken\.md.*unterminated/is);
  });

  test("a fence that closes before the trailing content still parses", () => {
    const md = "```mermaid\nflowchart A --> B\n```\n\ntrailing words\n";
    expect(parseMermaidBlocks(md)).toEqual(["flowchart A --> B"]);
  });

  test("zero blocks refuses to validate", () => {
    expect(() => assertHasDiagrams(0)).toThrow(/No mermaid blocks/);
    expect(() => assertHasDiagrams(2)).not.toThrow();
  });
});

describe("mutation guardrails (stubbed git)", () => {
  const stub = (stdout) => async () => ({ ok: true, stdout, stderr: "" });

  test("a scope with no unstaged tracked edits passes preflight", async () => {
    await expect(assertPreflightClean("packages/shared", stub(""))).resolves.toBeUndefined();
  });

  test("preexisting unstaged edits refuse the run and name the files", async () => {
    await expect(
      assertPreflightClean("packages/shared", stub("packages/shared/src/filters.ts")),
    ).rejects.toThrow(/refusing.*filters\.ts/is);
  });

  test("a failed git probe fails closed instead of silently passing", async () => {
    const failed = async () => ({ ok: false, stdout: "", stderr: "boom" });
    await expect(assertPreflightClean("packages/shared", failed)).rejects.toThrow(
      /cannot verify.*boom/is,
    );
    await expect(assertCleanup("packages/shared", failed)).rejects.toThrow(
      /cannot verify mutation residue/i,
    );
  });

  test("dirtyTrackedFiles surfaces the failed probe result", async () => {
    const failed = async () => ({ ok: false, stdout: "", stderr: "git misconfigured" });
    const probed = await dirtyTrackedFiles("packages/shared", failed);
    expect(probed.ok).toBe(false);
    expect(probed.error).toMatch(/git misconfigured/);
  });

  test("post-run cleanup restores mutation residue exactly once and fails", async () => {
    const restoreCalls = [];
    const runGit = async (args) => {
      if (args[0] === "diff") {
        return { ok: true, stdout: "apps/api/src/server.ts", stderr: "" };
      }
      if (args[0] === "restore") {
        restoreCalls.push(args.join(" "));
        return { ok: true, stdout: "", stderr: "" };
      }
      return { ok: true, stdout: "", stderr: "" };
    };
    await expect(assertCleanup("apps/api", runGit)).rejects.toThrow(/cleanup assertion failed/i);
    expect(restoreCalls).toEqual(["restore -- apps/api"]);
  });
});

describe("mutation preflight (real tree)", () => {
  const scratchPath = new URL("../packages/shared/src/index.ts", import.meta.url);
  let scratchOriginal = null;

  afterEach(async () => {
    // belt and braces: the try/finally below already restores; this catches
    // a mid-test throw so the worktree never keeps the scratch byte
    if (scratchOriginal !== null) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(scratchPath, scratchOriginal);
      scratchOriginal = null;
    }
  });

  test("a scratch unstaged edit in a scope refuses the preflight", async () => {
    const { appendFileSync, readFileSync, statSync, writeFileSync } = await import("node:fs");
    const beforeBytes = readFileSync(scratchPath);
    scratchOriginal = readFileSync(scratchPath, "utf8");

    try {
      appendFileSync(scratchPath, "\n");
      await expect(assertPreflightClean("packages/shared")).rejects.toThrow(
        /refusing to run in-place mutation/i,
      );
    } finally {
      writeFileSync(scratchPath, scratchOriginal);
      scratchOriginal = null;
    }

    // exact restore: byte length must match what the test found
    expect(statSync(scratchPath).size).toBe(beforeBytes.length);
  });
});
