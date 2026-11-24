import { describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALLOW_MARKER,
  buildChangeNamePattern,
  changeNamesWithoutCapabilities,
  extractChangeNames,
  isScannablePath,
  listChangeNames,
  looksBinary,
  runCheck,
  scanFiles,
} from "./check-tracking-refs.mjs";

/**
 * The tracking-reference gate: pattern classes hit their references and
 * leave legitimate lookalikes alone, scope exclusions keep the planning
 * workspace / lockfile / dataset / binaries / pinned skills out, the
 * allow marker is the line-level escape hatch, and the exit codes match
 * the lint-gate contract. Fixtures are injected file lists, so the suite
 * needs no repository state.
 *
 * Every fixture line below that deliberately contains a reference-shaped
 * literal carries the allow marker in the SOURCE so this file stays
 * clean under its own gate; assertions quote only bare-number fragments,
 * which the documented bare-N.N gap keeps invisible.
 */

/** Collect write() lines into one string for output assertions. */
function captureOutput(run) {
  const lines = [];
  const code = run((line) => lines.push(line));
  return { code, output: lines.join("\n") };
}

describe("tracking-reference patterns", () => {
  test("a task-shaped reference hits in any letter case and wording", () => {
    const content = [
      "fix task 4.2 first", // tracking-ref-allow
      "Task 8.4 caps the sprint", // tracking-ref-allow
      "tasks 2.1 and their follow-ups move too", // tracking-ref-allow
      "the plan lands 1.7 this week", // tracking-ref-allow
    ].join("\n");
    const { hits } = scanFiles({ files: [{ file: "notes.md", content }], changeNames: [] });
    expect(hits).toHaveLength(4);
    expect(hits[0].line).toBe(1);
    expect(hits[0].text.endsWith("4.2")).toBe(true);
    expect(hits[1].text.endsWith("8.4")).toBe(true);
    expect(hits[2].text.startsWith("tasks")).toBe(true);
    expect(hits[3].text.endsWith("1.7")).toBe(true);
  });

  test("version-like numbers and bare dotted numbers stay invisible", () => {
    const content = [
      "runs on Svelte 5.x with Node 22.12",
      "Git 2.54 handles the worktree",
      "pinned @0.1.28 upstream",
      "bare 6.1 and 1.7 stay an eyeball category",
      "fixed task 42 without a fraction",
    ].join("\n");
    expect(scanFiles({ files: [{ file: "notes.md", content }], changeNames: [] }).hits).toEqual([]);
  });

  test("a block-shaped reference hits, everyday prose with block does not", () => {
    const content = [
      "block 2 lists the layout work", // tracking-ref-allow
      "blocks 4–5 move to review", // tracking-ref-allow
      "a block of work without a number",
      "the block moved on to polish",
    ].join("\n");
    const { hits } = scanFiles({ files: [{ file: "notes.md", content }], changeNames: [] });
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(1);
    expect(hits[1].line).toBe(2);
  });

  test("a bare D-plus-digits token hits as a decision id, a lowercase one does not", () => {
    const content = [
      "per design D18 the band owns clear-all", // tracking-ref-allow
      "recorded in (D17) instead", // tracking-ref-allow
      "a stray D5 slipped into a CSS comment", // tracking-ref-allow
      "see d1 and d3 fragments, not decision references",
    ].join("\n");
    const { hits } = scanFiles({ files: [{ file: "comment.css", content }], changeNames: [] });
    expect(hits).toHaveLength(3);
    expect(hits.every((hit) => /^D[0-9]+$/.test(hit.text))).toBe(true);
  });

  test("a decision-id-shaped library name still hits and needs the marker", () => {
    // Documented trade-off: D3.js is mechanically indistinguishable from // tracking-ref-allow
    // decision id D3 — the escape hatch is the answer, not pattern magic. // tracking-ref-allow
    const content = "D3.js renders the chart"; // tracking-ref-allow
    const { hits } = scanFiles({ files: [{ file: "docs/charts.md", content }], changeNames: [] });
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toMatch(/^D3/); // tracking-ref-allow
  });

  test("a change name matches as a whole identifier only", () => {
    const names = extractChangeNames(["sample-change", "2026-01-02-legacy-widget"]);
    const content = [
      "per sample-change the band clears first",
      "legacy-widget already archived this",
      "sample-change-two supersedes it, so no match",
      "a presample-change mention is a different word",
      "sample-change_extra is a different identifier",
    ].join("\n");
    const { hits } = scanFiles({ files: [{ file: "notes.md", content }], changeNames: names });
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(1);
    expect(hits[1].line).toBe(2);
  });

  test("the change-name pattern is null without names and never matches then", () => {
    expect(buildChangeNamePattern([])).toBeNull();
    const content = "sample-change stays invisible with no names configured";
    expect(scanFiles({ files: [{ file: "notes.md", content }], changeNames: [] }).hits).toEqual([]);
  });

  test("the allow marker skips a line that would otherwise hit", () => {
    const content = [
      "see task 4.2 now", // tracking-ref-allow
      "see task 4.3 later", // tracking-ref-allow
    ].join("\n");
    const markedFixtureLine = `see task 4.4 much later ${ALLOW_MARKER}`; // tracking-ref-allow
    const { hits } = scanFiles({
      files: [{ file: "notes.md", content: `${content}\n${markedFixtureLine}` }],
      changeNames: [],
    });
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(1);
    expect(hits[1].line).toBe(2);
  });

  test("markdown fenced blocks are skipped, prose lines are not", () => {
    const content = [
      "```sh",
      "grep the logs for D5-shaped ids", // tracking-ref-allow
      "```",
      "and a prose D6 mention outside the fence", // tracking-ref-allow
    ].join("\n");
    const { hits } = scanFiles({ files: [{ file: "guide.md", content }], changeNames: [] });
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(4);
    // the same scan over a non-markdown file keeps the fence line visible
    const codeHits = scanFiles({
      files: [{ file: "guide.ts", content }],
      changeNames: [],
    }).hits;
    expect(codeHits).toHaveLength(2);
  });

  test("a tilde fence hides its content like a backtick fence", () => {
    const content = [
      "~~~",
      "inside the tilde fence a D7-shaped id sits", // tracking-ref-allow
      "~~~",
      "a prose D8 mention outside", // tracking-ref-allow
    ].join("\n");
    const { hits, unclosed } = scanFiles({
      files: [{ file: "guide.md", content }],
      changeNames: [],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(4);
    expect(unclosed).toEqual([]);
  });

  test("a fence left open is reported without failing the scan", () => {
    const content = [
      "```sh",
      "the D9-shaped id inside never closes the fence", // tracking-ref-allow
    ].join("\n");
    const { hits, unclosed } = scanFiles({
      files: [{ file: "guide.md", content }],
      changeNames: [],
    });
    expect(hits).toEqual([]);
    expect(unclosed).toEqual(["guide.md"]);
  });
});

describe("scope exclusions", () => {
  test("the planning workspace, lockfile, dataset, and pinned skills are out of scope", () => {
    expect(isScannablePath("openspec/changes/sample/spec.md")).toBe(false);
    expect(isScannablePath("openspec/changes/archive/2026-01-02-old/spec.md")).toBe(false);
    expect(isScannablePath("pnpm-lock.yaml")).toBe(false);
    expect(isScannablePath("data/units.json")).toBe(false);
    expect(isScannablePath(".agents/skills/svelte/SKILL.md")).toBe(false);
  });

  test("regular repo text stays in scope and binaries are out by extension", () => {
    expect(isScannablePath("apps/web/src/lib/a.ts")).toBe(true);
    expect(isScannablePath("README.md")).toBe(true);
    expect(isScannablePath("scripts/check-diagrams.mjs")).toBe(true);
    expect(isScannablePath("assets/logo.png")).toBe(false);
    expect(isScannablePath("fonts/inter.woff2")).toBe(false);
  });

  test("a NUL byte marks a file binary even without a telltale extension", () => {
    expect(looksBinary(Buffer.from("plain text file\n"))).toBe(false);
    expect(looksBinary(Buffer.from([0x7b, 0x00, 0x7d, 0x0a]))).toBe(true);
  });

  test("dated feedback records are exempt while a sibling docs file naming the same change is not", () => {
    // docs/feedback/ holds dated, user-signed walkthrough records —
    // historical snapshots, like the commit messages the rule exempts.
    expect(isScannablePath("docs/feedback/2026-11-07-walkthrough.md")).toBe(false);
    // The exemption is scoped to that directory only: the same naming
    // content in a sibling docs file stays flagged.
    const content = "the sample-change research request"; // tracking-ref-allow
    const { hits } = scanFiles({
      files: [{ file: "docs/research-notes.md", content }],
      changeNames: extractChangeNames(["sample-change"]),
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].file).toBe("docs/research-notes.md");
  });
});

describe("change-name derivation", () => {
  test("archived folders contribute their name part, active folders contribute verbatim", () => {
    expect(extractChangeNames(["sample-change", "2026-01-02-legacy-widget"])).toEqual([
      "sample-change",
      "legacy-widget",
    ]);
  });

  test("the archive directory itself and duplicate names drop out", () => {
    expect(extractChangeNames(["archive", "sample-change", "sample-change"])).toEqual([
      "sample-change",
    ]);
  });

  test("a name that is also a main-spec capability drops out; a same-shape name only under changes stays", () => {
    // `feature-flags` names a capability (openspec/specs/feature-flags/),
    // so referencing it anywhere is legitimate — only the archived CHANGE
    // happened to share the name.
    expect(
      changeNamesWithoutCapabilities(
        ["feature-flags", "sample-widget", "2026-01-02-feature-flags"],
        ["feature-flags"],
      ),
    ).toEqual(["sample-widget"]);
    expect(changeNamesWithoutCapabilities(["feature-flags"], [])).toEqual(["feature-flags"]);
  });

  test("the real listing reads both directories and applies the capability exclusion", () => {
    const root = mkdtempSync(join(tmpdir(), "tracking-refs-"));
    try {
      mkdirSync(join(root, "openspec/changes/archive/2026-01-02-feature-flags"), {
        recursive: true,
      });
      mkdirSync(join(root, "openspec/changes/sample-widget"), { recursive: true });
      mkdirSync(join(root, "openspec/specs/feature-flags"), { recursive: true });
      expect(listChangeNames(root)).toEqual(["sample-widget"]);
      expect(listChangeNames(root, { changes: ["sample-widget"], specs: [] })).toEqual([
        "sample-widget",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const lstatAnyFile = () => ({ isFile: () => true });

describe("exit codes and output", () => {
  test("a hit exits 1, names file and line, and points at the rule", () => {
    const { code, output } = captureOutput((write) =>
      runCheck({
        listFiles: () => ["notes.ts"],
        read: () => Buffer.from("fix task 4.2\n"), // tracking-ref-allow
        lstat: lstatAnyFile,
        changeNames: [],
        write,
      }),
    );
    expect(code).toBe(1);
    expect(output).toContain("notes.ts:1:");
    expect(output).toContain("4.2");
    expect(output).toContain("AGENTS.md");
    expect(output).toContain(ALLOW_MARKER);
  });

  test("a clean tree exits 0 with a one-line summary", () => {
    const { code, output } = captureOutput((write) =>
      runCheck({
        listFiles: () => ["notes.ts"],
        read: () => Buffer.from("clean prose about filters\n"),
        lstat: lstatAnyFile,
        changeNames: [],
        write,
      }),
    );
    expect(code).toBe(0);
    expect(output).toContain("checked 1 file(s)");
    expect(output).toContain("no OpenSpec-internal tracking references");
  });

  test("binary files are skipped, counted, and never fail the gate", () => {
    const { code, output } = captureOutput((write) =>
      runCheck({
        listFiles: () => ["assets/blob.dat", "notes.ts"],
        read: (file) =>
          file === "notes.ts" ? Buffer.from("clean prose\n") : Buffer.from([0x00, 0x01]),
        lstat: lstatAnyFile,
        changeNames: [],
        write,
      }),
    );
    expect(code).toBe(0);
    expect(output).toContain("1 binary/unreadable skipped");
  });

  test("an oversized file is skipped with a notice and never fails the gate", () => {
    const { code, output } = captureOutput((write) =>
      runCheck({
        listFiles: () => ["big.md", "notes.ts"],
        read: (file) =>
          file === "notes.ts" ? Buffer.from("clean prose\n") : Buffer.alloc(1024 * 1024 + 1, 0x41),
        lstat: lstatAnyFile,
        changeNames: [],
        write,
      }),
    );
    expect(code).toBe(0);
    expect(output).toContain("skipping oversized file (>1 MiB): big.md");
  });

  test("an unclosed fence is reported through the output without failing the gate", () => {
    const { code, output } = captureOutput((write) =>
      runCheck({
        listFiles: () => ["guide.md"],
        read: () => Buffer.from("```sh\nthe D9-shaped id inside never closes the fence\n"), // tracking-ref-allow
        lstat: lstatAnyFile,
        changeNames: [],
        write,
      }),
    );
    expect(code).toBe(0);
    expect(output).toContain("notice: unclosed fence in guide.md; remainder not scanned");
  });
});
