import { describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PLANNED,
  extractCodeSpans,
  gitIgnoredTokens,
  internalErrorExitCode,
  isPathLike,
  listScopeFiles,
  regularFilesIn,
  repoRoot,
  runCheck,
  sanitizeForDisplay,
  scanReferences,
  skipReason,
  stripSuffixes,
} from "./check-references.mjs";

/**
 * The prose reference gate: backticked path-like tokens in docs and
 * planning markdown must resolve (or be explicitly allowlisted), while
 * measurement-derived noise stays out of the flag list. Fixture trees are
 * real temp directories; git inputs (`git ls-files` output, ignore
 * checks) are injected so the suite needs no repository state.
 */

const ROOT_HIT = "apps/web/src/lib/detail-values.ts";
const APP_SHORTHAND = "src/lib/detail-values.ts";
const OPENSPEC_SHORTHAND = "changes/sample-change/spec.md";

/** A doc exercising every resolution outcome and every skip rule. */
const GUIDE_LINES = [
  "A markdown link](README.md) stays invisible to the extractor.",
  `Root hit: \`${ROOT_HIT}\`.`,
  `App shorthand: \`${APP_SHORTHAND}\`.`,
  `Planning shorthand: \`${OPENSPEC_SHORTHAND}\`.`,
  `Anchored and line-suffixed forms: \`${ROOT_HIT}#L42\`, \`${OPENSPEC_SHORTHAND}:12\`.`,
  "Ghost paths: `docs/ghost.md` and `apps/web/src/lib/missing.ts:12`.",
  "Bare unique: `detail-values.ts`; bare ambiguous: `filters.ts`.",
  "Planned file and planned directory: `docs/planned-review.md`, `docs/feedback/`, `docs/feedback/notes.md`.",
  "Noise: `/api/units` `.git/config` `http://localhost:5173` `@scope/pkg` `mcr.microsoft.com/playground:v1.1.1` `ghcr.io/org/img` `\\d+` `^anchor$` `a+b?` `*.md` `docs/<date>/note.md` `{a,b}` `~/.config` `n$` `pnpm test` `node script.mjs` `git status` `openspec validate --all` `docker compose up` `npx -y pkg@1.0.0` `bunx foo`.",
  `Repeat of the first: \`${ROOT_HIT}\`.`,
];

const GUIDE_WITH_STALE = GUIDE_LINES.join("\n");
const GUIDE_WITHOUT_STALE = GUIDE_LINES.filter((line) => !line.startsWith("Ghost paths:")).join(
  "\n",
);

const TRACKED = [
  "README.md",
  "package.json",
  "apps/api/routes/filters.ts",
  "apps/web/package.json",
  "apps/web/src/lib/detail-values.ts",
  "docs/guide.md",
  "openspec/changes/sample-change/spec.md",
  "packages/shared/src/filters.ts",
];

const TEST_PLANNED = {
  "docs/planned-review.md": "deliverable of a sample review change (planned, not yet landed)",
  "docs/feedback/": "record directory of a sample feedback change (planned, not yet landed)",
};

/** A git-less fixture tree whose shape mirrors the repo's roots. */
function makeGuideTree(guideContent) {
  const root = mkdtempSync(join(tmpdir(), "reference-check-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  mkdirSync(join(root, "apps", "web", "src", "lib"), { recursive: true });
  mkdirSync(join(root, "apps", "api", "routes"), { recursive: true });
  mkdirSync(join(root, "openspec", "changes", "sample-change"), { recursive: true });
  writeFileSync(join(root, "docs", "guide.md"), guideContent);
  writeFileSync(join(root, "apps", "web", "src", "lib", "detail-values.ts"), "");
  writeFileSync(join(root, "openspec", "changes", "sample-change", "spec.md"), "");
  return root;
}

function runOnTree(root, argv = []) {
  const lines = [];
  const code = runCheck({
    root,
    listFiles: () => ({ scope: ["docs/guide.md"], all: TRACKED }),
    read: (file) => readFileSync(join(root, file), "utf8"),
    write: (line) => lines.push(line),
    argv,
    planned: TEST_PLANNED,
    ignoreCheck: () => new Set(),
  });
  return { code, lines };
}

describe("backtick span extraction", () => {
  test("code spans extract in order while links and plain prose stay invisible", () => {
    const markdown = "see [root](README.md) and `docs/guide.md` then plain docs/guide.md";
    expect(extractCodeSpans(markdown)).toEqual(["docs/guide.md"]);
  });

  test("a backtick pair split across lines matches nothing at all", () => {
    expect(extractCodeSpans("`docs/guide.md\nstill inside`")).toEqual([]);
  });
});

describe("noise-category skip rules", () => {
  test("every measurement noise category drops its token before the path-like test", () => {
    const noise = [
      "/api/units", // leading slash: URL route, absolute path, command
      ".git/config", // git-internal, never tracked
      "http://localhost:5173", // URL with scheme
      "@scope/pkg", // package ref
      "mcr.microsoft.com/playground:v1.1.1", // registry image host
      "ghcr.io/org/img", // registry image host
      "\\d+", // regex metachars
      "^anchor$", // regex metachars
      "a+b?", // regex metachars
      "*.md", // glob
      "docs/<date>/note.md", // placeholder
      "{a,b}", // placeholder
      "~/.config", // placeholder
      "n$", // placeholder (and regex metachar)
      "pnpm test", // whitespace (invocation)
      "node script.mjs", // whitespace (invocation)
      "git status", // command prefix
      "openspec validate --all", // command prefix
      "docker compose up", // command prefix
      "npx -y pkg@1.0.0", // command prefix
      "bunx foo", // command prefix
    ];
    for (const token of noise) {
      expect(skipReason(token), token).not.toBeNull();
    }
  });

  test("parent-relative path segments are rejected before resolution", () => {
    expect(skipReason("docs/../secret.md")).not.toBeNull();
    expect(skipReason("../../etc/passwd")).not.toBeNull();
    expect(skipReason("docs/guide.md")).toBeNull();
    expect(skipReason("docs/a.b/notes.md")).toBeNull();
  });

  test("oversized tokens are rejected at the resource cap", () => {
    expect(skipReason("a".repeat(500))).toBeNull();
    expect(skipReason(`${"a".repeat(501)}`)).not.toBeNull();
  });

  test("command invocations report as commands, not whitespace", () => {
    expect(skipReason("pnpm test")).toBe("command prefix");
    expect(skipReason("a b")).toBe("whitespace (prose or command invocation)");
  });

  test("real filenames that merely start with a command word stay in scope", () => {
    expect(skipReason("docker-compose.yaml")).toBeNull();
    expect(skipReason("node-types.md")).toBeNull();
  });

  test("keeper tokens pass the skip rules untouched", () => {
    expect(skipReason(ROOT_HIT)).toBeNull();
    expect(skipReason("detail-values.ts")).toBeNull();
    expect(skipReason("package.json")).toBeNull();
  });
});

describe("suffix stripping and the path-like test", () => {
  test("anchors and line suffixes strip before a token is checked", () => {
    expect(stripSuffixes("docs/guide.md#reading-order")).toBe("docs/guide.md");
    expect(stripSuffixes("docs/guide.md#L12-15")).toBe("docs/guide.md");
    expect(stripSuffixes("apps/web/src/lib/filters.ts:42")).toBe("apps/web/src/lib/filters.ts");
    expect(stripSuffixes("apps/web/src/lib/filters.ts:42-48")).toBe("apps/web/src/lib/filters.ts");
    expect(stripSuffixes("compose.yaml")).toBe("compose.yaml");
  });

  test("slashes make a token path-like and known extensions do too", () => {
    expect(isPathLike("src/lib/filters.ts")).toBe(true);
    expect(isPathLike("compose.yaml")).toBe(true);
    expect(isPathLike("detail-values.ts")).toBe(true);
    expect(isPathLike("localhost")).toBe(false);
    expect(isPathLike("walkthrough-feedback")).toBe(false);
  });
});

describe("resolution over a fixture tree", () => {
  test("rooted shorthand resolves through repo root, apps/web, then openspec", () => {
    const root = makeGuideTree(GUIDE_WITHOUT_STALE);
    try {
      const result = scanReferences({
        files: [
          { file: "docs/guide.md", content: readFileSync(join(root, "docs/guide.md"), "utf8") },
        ],
        trackedFiles: TRACKED,
        root,
        planned: TEST_PLANNED,
      });
      expect(result.stale).toEqual([]);
      expect(result.checked).toBe(8);
      expect(result.resolved).toBe(4);
      expect(result.planned).toBe(3);
      expect(result.advisories).toEqual([
        {
          file: "docs/guide.md",
          token: "filters.ts",
          matches: ["apps/api/routes/filters.ts", "packages/shared/src/filters.ts"],
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("unresolvable paths flag as stale with the stripped token on a sorted line", () => {
    const root = makeGuideTree(GUIDE_WITH_STALE);
    try {
      const { code, lines } = runOnTree(root);
      expect(code).toBe(1);
      expect(lines.slice(0, 3)).toEqual([
        "stale references (2):",
        "docs/guide.md -> apps/web/src/lib/missing.ts",
        "docs/guide.md -> docs/ghost.md",
      ]);
      expect(lines.at(-1)).toBe(
        "checked 10 path-like reference(s) in 1 file(s): 4 resolved, " +
          "3 planned (allowlisted), 0 ignored (gitignored/conditional), 2 stale, 1 advisory",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("report-only mode prints the identical scan but always exits zero", () => {
    const root = makeGuideTree(GUIDE_WITH_STALE);
    try {
      const strict = runOnTree(root);
      const reportOnly = runOnTree(root, ["--report-only"]);
      expect(reportOnly.code).toBe(0);
      expect(reportOnly.lines).toEqual(strict.lines);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("advisory ambiguity alone never fails the gate in strict mode", () => {
    const root = makeGuideTree(GUIDE_WITHOUT_STALE);
    try {
      const { code, lines } = runOnTree(root);
      expect(code).toBe(0);
      expect(lines.some((line) => line.includes("filters.ts"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("allowlisted paths pass silently, exact for files and by prefix for directories", () => {
    const result = scanReferences({
      files: [
        {
          file: "docs/guide.md",
          content: "`docs/planned-review.md` `docs/feedback/` `docs/feedback/notes.md`",
        },
      ],
      trackedFiles: TRACKED,
      root: "/nonexistent-root-that-must-never-be-probed",
      planned: TEST_PLANNED,
    });
    expect(result.planned).toBe(3);
    expect(result.stale).toEqual([]);
    expect(result.checked).toBe(3);
  });

  test("stale candidates that git ignores count as conditional, not stale", () => {
    const result = scanReferences({
      files: [{ file: "docs/guide.md", content: "`docs/ghost.md` `docs/scratch-local.md`" }],
      trackedFiles: TRACKED,
      root: "/nonexistent-root-that-must-never-be-probed",
      ignoreCheck: (tokens) => new Set(tokens.filter((token) => token === "docs/ghost.md")),
    });
    expect(result.stale).toEqual([{ file: "docs/guide.md", token: "docs/scratch-local.md" }]);
    expect(result.ignored).toBe(1);
  });

  test("a zero-match bare name flags stale exactly like a missing path", () => {
    const result = scanReferences({
      files: [{ file: "docs/guide.md", content: "`ghost-file.ts`" }],
      trackedFiles: TRACKED,
      root: "/nonexistent-root-that-must-never-be-probed",
    });
    expect(result.stale).toEqual([{ file: "docs/guide.md", token: "ghost-file.ts" }]);
  });
});

describe("print-layer sanitization", () => {
  test("control characters are escaped and overlong values truncated", () => {
    expect(sanitizeForDisplay("a\u001bb")).toBe("a\\u001bb");
    expect(sanitizeForDisplay("a\u2028b")).toBe("a\\u2028b");
    const long = sanitizeForDisplay("x".repeat(250));
    expect(long.endsWith("...")).toBe(true);
    expect(long.length).toBe(203);
  });

  test("raw control characters in tokens never reach the output lines", () => {
    const lines = [];
    const code = runCheck({
      root: "/nonexistent-root-that-must-never-be-probed",
      listFiles: () => ({ scope: ["docs/guide.md"], all: [] }),
      read: () => "`docs/ghost\u001b.md` and `docs/" + "y".repeat(300) + ".md`",
      write: (line) => lines.push(line),
      argv: [],
      planned: TEST_PLANNED,
      ignoreCheck: () => new Set(),
    });
    expect(lines[0]).toBe("stale references (2):");
    for (const line of lines.slice(1, 3)) {
      // oxlint-disable-next-line no-control-regex -- intentional: proving the raw character was escaped away
      expect(line).not.toMatch(/\u001b/);
    }
    expect(lines.slice(1, 3).some((line) => line.includes("\\u001b"))).toBe(true);
    expect(lines.slice(1, 3).some((line) => line.endsWith("..."))).toBe(true);
    expect(code).toBe(1);
  });
});

describe("resource caps and failure posture", () => {
  test("an oversized file is skipped with a warning instead of being scanned", () => {
    const lines = [];
    const code = runCheck({
      root: "/nonexistent-root-that-must-never-be-probed",
      listFiles: () => ({ scope: ["docs/huge.md"], all: [] }),
      read: () => "x".repeat(1024 * 1024 + 1),
      write: (line) => lines.push(line),
      argv: [],
      planned: TEST_PLANNED,
      ignoreCheck: () => new Set(),
    });
    expect(code).toBe(0);
    expect(lines[0]).toBe("skipping oversized file (>1 MiB): docs/huge.md");
    expect(lines.at(-1)).toContain("checked 0 path-like reference(s) in 0 file(s)");
  });

  test("report-only survives internal errors where strict mode fails", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(internalErrorExitCode(new Error("boom"), ["--report-only"])).toBe(0);
      expect(internalErrorExitCode(new Error("boom"), [])).toBe(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("only regular files survive scope enumeration; symlinks are skipped", () => {
    const root = mkdtempSync(join(tmpdir(), "reference-symlink-"));
    try {
      writeFileSync(join(root, "real.md"), "x");
      symlinkSync("real.md", join(root, "hard-link.md"));
      symlinkSync("nowhere-at-all", join(root, "broken.md"));
      symlinkSync(".", join(root, "dir-link.md"));
      const kept = regularFilesIn(root, [
        "real.md",
        "hard-link.md",
        "broken.md",
        "dir-link.md",
        "ghost.md",
      ]);
      expect(kept).toEqual(["real.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the landed-entry advisory", () => {
  test("a landed allowlist entry surfaces as an advisory removal line", () => {
    const lines = [];
    const code = runCheck({
      root: "/nonexistent-root-that-must-never-be-probed",
      listFiles: () => ({ scope: [], all: [] }),
      read: () => "",
      write: (line) => lines.push(line),
      argv: [],
      planned: TEST_PLANNED,
      ignoreCheck: () => new Set(),
      exists: (candidate) => candidate.endsWith("docs/planned-review.md"),
    });
    expect(code).toBe(0);
    expect(lines).toContain("PLANNED entry landed — remove: docs/planned-review.md");
    expect(lines.some((line) => line.includes("docs/feedback/"))).toBe(false);
  });
});

describe("the git-ignore rescue over real git", () => {
  test("git-ignored paths are reported ignored and plain paths are not", () => {
    // the repo root itself: check-ignore matches patterns without needing
    // the probed paths to exist on disk
    const ignored = gitIgnoredTokens(repoRoot, ["AGENTS.local.md", ".scratch/", "docs/guide.md"]);
    expect(ignored.has("AGENTS.local.md")).toBe(true);
    expect(ignored.has(".scratch/")).toBe(true);
    expect(ignored.has("docs/guide.md")).toBe(false);
  });
});

describe("default file discovery (real tree)", () => {
  test("the scan scope keeps active planning and docs but drops the archive", () => {
    const { scope, all } = listScopeFiles();
    expect(scope).toContain("README.md");
    expect(scope).toContain("AGENTS.md");
    expect(scope.some((file) => file.startsWith("docs/"))).toBe(true);
    expect(scope.some((file) => file.startsWith("openspec/changes/"))).toBe(true);
    expect(scope.every((file) => file.endsWith(".md"))).toBe(true);
    expect(scope.every((file) => !file.startsWith("openspec/changes/archive/"))).toBe(true);
    expect(all).toContain("package.json");
  });
});

describe("the planned allowlist", () => {
  test("every planned path gives a lifecycle reason free of tracking references", () => {
    expect(Object.keys(PLANNED).sort()).toEqual([
      "apps/web/e2e/walkthrough.capture.ts",
      "docs/documentation-review.md",
      "docs/feedback/",
    ]);
    for (const reason of Object.values(PLANNED)) {
      expect(reason).toMatch(/^planned/);
      expect(reason).toMatch(/not yet landed/);
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});
