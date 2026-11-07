/**
 * Prose reference check (the backticked-path gate for docs and planning).
 *
 * Mechanism: prose in README.md, AGENTS.md, docs/ (all markdown, any
 * depth) and active openspec/changes/ (archive excluded) references repo
 * files inside backtick code
 * spans, and nothing validated those references (markdown link checkers
 * cannot see code spans). This script extracts the spans, keeps the
 * path-like tokens, and existence-checks each, so a stale prose path
 * reports — and in strict mode (the default when run directly) exits 1.
 *
 * The extractor rules come from a one-way measurement of this corpus
 * (2026-11-07: 613 path-like tokens, 118 raw flags) whose six noise
 * categories account for every raw flag — they stay distinct here:
 *   1. archive exclusion       — archived changes are a historical
 *                                snapshot, not living prose
 *   2. leading-slash skip      — URL routes, absolute paths, commands
 *   3. package/registry skips  — @scope/pkg refs, mcr./ghcr. image hosts
 *   4. non-path token skips    — regex metachars, glob/placeholder chars,
 *                                whitespace, command prefixes, URL schemes
 *   5. resolution roots        — repo root → apps/web/ → openspec/,
 *                                first hit wins (app- and openspec-
 *                                relative prose shorthand)
 *   6. gitignored / conditional — paths git ignores are machine-local or
 *                              conditional by construction (one batched
 *                              `git check-ignore` pass over the stale
 *                              candidates); planned-not-yet-landed files
 *                              go through the PLANNED allowlist below
 *
 * Bare filenames (no slash) resolve against `git ls-files`: exactly one
 * match passes, zero matches flags, multiple matches report as advisory
 * only — a legitimately ambiguous name (`tasks.md`, `package.json`) can
 * never fail the gate.
 *
 * Deterministic output: sorted `file -> token` lines, no timestamps, one
 * summary line — diffable and greppable in CI logs. Values are sanitized
 * at the print layer (control characters escaped, overlong tokens
 * truncated) so prose can never forge log lines; counts and logic always
 * use the raw tokens. `--report-only` runs the identical scan and always
 * exits 0 (the current CI posture; strict comes later as its own flip) —
 * even on internal error, so it can never break the CI gate.
 *
 * Plain Node ESM, zero npm dependencies, run from the repo root — same
 * mold as scripts/check-diagrams.mjs.
 */

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Resource caps: runaway prose can never blow up the scan. */
const MAX_TOKEN_CHARS = 500;
const MAX_TOKEN_DISPLAY_CHARS = 200;
const MAX_FILE_BYTES = 1024 * 1024;
const GIT_SPAWN_LIMITS = { maxBuffer: 16 * 1024 * 1024, timeout: 30000 };

// oxlint-disable-next-line no-control-regex -- intentional: matched control characters are escaped for log safety
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g;

/**
 * Print-layer sanitization only: counts and logic always use raw tokens.
 * Control and invisible characters are replaced with their escaped form
 * (log-forgery defense) and overlong values are truncated.
 */
export function sanitizeForDisplay(value, limit = MAX_TOKEN_DISPLAY_CHARS) {
  const escaped = value.replace(CONTROL_CHARS, (char) => {
    const form = JSON.stringify(char).slice(1, -1);
    // JSON.stringify leaves e.g. U+2028/U+2029 raw — escape those explicitly
    return form === char ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}` : form;
  });
  return escaped.length > limit ? `${escaped.slice(0, limit)}...` : escaped;
}

/**
 * Noise category 6: paths that legitimately do not exist yet. Keys are
 * repo-root paths written exactly as prose writes them; a key ending in
 * `/` prefix-matches that directory's future files. Reasons describe the
 * lifecycle honestly ("planned, not yet landed") without internal
 * tracking references — when the path lands, the entry is deleted,
 * never extended.
 */
export const PLANNED = {
  "docs/documentation-review.md": "planned review report, not yet landed",
  "docs/feedback/": "planned feedback-record directory, not yet landed",
  "apps/web/e2e/walkthrough.capture.ts":
    "planned walkthrough capture script (not part of the CI suites), not yet landed",
};

const PATH_LIKE_EXTENSIONS =
  /\.(?:ts|js|mjs|cjs|svelte|json|md|yaml|yml|toml|sh|css|html|txt|sql)$/;
const REGEX_METACHARS = /[\\^$+?]/;
const GLOB_PLACEHOLDER_CHARS = /[*<>{}$~]/;
const COMMAND_PREFIX = /^(?:pnpm|npm|npx|node|bunx|git|openspec|docker)\s/;
const REGISTRY_HOST = /^(?:mcr\.|ghcr\.)/;
const ANCHOR_SUFFIX = /#.*$/;
const LINE_SUFFIX = /:\d+(?:-\d+)?$/;

/** Backtick code spans only, in file order (decision: spans, not links). */
export function extractCodeSpans(markdown) {
  return [...markdown.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
}

/**
 * Noise categories 2–4: why a token is dropped before the path-like test.
 * Returns null for a keeper. Every rule is measurement-derived — adding
 * one requires a corpus flag it explains.
 */
export function skipReason(token) {
  if (token.length > MAX_TOKEN_CHARS) return "oversized token (resource cap)";
  if (token.startsWith("/")) return "leading slash (URL route, absolute path, command)";
  if (token.startsWith(".git/")) return "git-internal path (never tracked)";
  if (token.includes("://")) return "URL with scheme";
  if (token.startsWith("@")) return "@scope/ package ref";
  if (REGISTRY_HOST.test(token)) return "registry image host";
  if (REGEX_METACHARS.test(token)) return "regex metachar";
  if (GLOB_PLACEHOLDER_CHARS.test(token)) return "glob or placeholder char";
  if (COMMAND_PREFIX.test(token)) return "command prefix";
  if (/\s/.test(token)) return "whitespace (prose or command invocation)";
  // path confinement: a parent-relative segment escapes the repo roots
  if (token.split("/").includes("..")) return "parent-relative path segment";
  return null;
}

/** `#anchor` and `:line` suffixes are prose pointers, not path content. */
export function stripSuffixes(token) {
  return token.replace(ANCHOR_SUFFIX, "").replace(LINE_SUFFIX, "");
}

/** Slash counts as path-like outright; otherwise a known extension does. */
export function isPathLike(token) {
  return token.includes("/") || PATH_LIKE_EXTENSIONS.test(token);
}

function isPlanned(path, planned) {
  return Object.keys(planned).some(
    (key) => path === key || (key.endsWith("/") && path.startsWith(key)),
  );
}

/**
 * Noise category 6, mechanical half: one batched `git check-ignore`
 * pass over the stale candidates. A path git ignores is machine-local,
 * generated, or conditional by construction — prose referencing it is
 * never a tracked-file reference. (`.git/` internals never match ignore
 * patterns, so they are skipped upstream in `skipReason` instead.)
 */
export function gitIgnoredTokens(root, tokens) {
  if (tokens.length === 0) return new Set();
  const result = spawnSync("git", ["-C", root, "check-ignore", "-z", "--stdin"], {
    input: tokens.join("\0"),
    encoding: "utf8",
    ...GIT_SPAWN_LIMITS,
  });
  // exit 0 = at least one ignored, exit 1 = none ignored; both are fine
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(`git check-ignore failed: ${result.stderr || result.error}`);
  }
  return new Set(result.stdout.split("\0").filter(Boolean));
}

/**
 * The scan over already-read markdown. Pure over its inputs: files are
 * `{ file, content }` pairs with repo-relative display paths,
 * `trackedFiles` is injected `git ls-files` output (repo-relative,
 * `/`-separated), and `exists`/`root` stand in for the filesystem — so
 * fixture trees need no git at all. `ignoreCheck` receives the stale
 * candidate tokens and returns the gitignored subset (tests inject a
 * stub; the CLI wires `gitIgnoredTokens`).
 */
export function scanReferences({
  files,
  trackedFiles,
  root = repoRoot,
  planned = PLANNED,
  exists = existsSync,
  ignoreCheck = null,
}) {
  const resolveFromRoots = (token) =>
    ["", join("apps", "web"), "openspec"]
      .map((base) => join(root, base, token))
      .find((candidate) => exists(candidate));

  const stale = [];
  const advisories = [];
  const seen = new Set();
  // bare-name candidate lookup: one Set build, O(1) per token; the full
  // filter runs only for candidates that actually match (advisory case)
  const trackedBasenames = new Set(trackedFiles.map((tracked) => basename(tracked)));
  let checked = 0;
  let resolved = 0;
  let plannedCount = 0;

  for (const { file, content } of files) {
    for (const raw of extractCodeSpans(content)) {
      if (skipReason(raw) !== null) continue;
      const token = stripSuffixes(raw);
      if (!isPathLike(token)) continue;
      const key = `${file}\n${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      checked += 1;

      if (isPlanned(token, planned)) {
        plannedCount += 1;
      } else if (token.includes("/")) {
        if (resolveFromRoots(token) === undefined) stale.push({ file, token });
        else resolved += 1;
      } else if (!trackedBasenames.has(token)) {
        stale.push({ file, token });
      } else {
        const matches = trackedFiles.filter((tracked) => basename(tracked) === token);
        if (matches.length === 1) resolved += 1;
        else advisories.push({ file, token, matches });
      }
    }
  }

  const before = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const byFileThenToken = (a, b) => before(a.file, b.file) || before(a.token, b.token);

  let ignoredCount = 0;
  let staleFlags = stale;
  if (ignoreCheck !== null && stale.length > 0) {
    const ignored = ignoreCheck(stale.map((flag) => flag.token));
    staleFlags = stale.filter((flag) => !ignored.has(flag.token));
    ignoredCount = stale.length - staleFlags.length;
  }
  staleFlags.sort(byFileThenToken);
  advisories.sort(byFileThenToken);
  return {
    checked,
    resolved,
    planned: plannedCount,
    ignored: ignoredCount,
    stale: staleFlags,
    advisories,
    fileCount: files.length,
  };
}

const SCOPE_PATHS = ["README.md", "AGENTS.md", "docs", "openspec/changes"];

function gitListFiles(root, pathspecs) {
  const result = spawnSync("git", ["-C", root, "ls-files", "-z", ...pathspecs], {
    encoding: "utf8",
    ...GIT_SPAWN_LIMITS,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.error}`);
  }
  // NUL-separated output: byte-exact paths, immune to core.quotePath
  // C-escaping of non-ASCII names
  return result.stdout.split("\0").filter(Boolean);
}

/**
 * Scope safety: only regular files are scanned. A symlinked (or vanished)
 * path would let prose walk outside the checkout — it is skipped silently
 * (deterministically: the skip never appears in output).
 */
export function regularFilesIn(root, paths, lstat = lstatSync) {
  return paths.filter((file) => {
    try {
      return lstat(join(root, file)).isFile();
    } catch {
      return false;
    }
  });
}

/** Category 1 lives here: archive paths are filtered from the scope. */
export function listScopeFiles(root = repoRoot) {
  const scope = regularFilesIn(
    root,
    gitListFiles(root, SCOPE_PATHS).filter(
      (file) => file.endsWith(".md") && !file.startsWith("openspec/changes/archive/"),
    ),
  );
  const all = gitListFiles(root, []);
  return { scope, all };
}

/**
 * Full check: discover, read, scan, print. Returns the exit code — 1 only
 * on stale flags in strict mode; advisories and --report-only never do.
 * Oversized files are skipped with a warning; landed allowlist entries
 * surface as advisory lines so the future strict flip is mechanical.
 */
export function runCheck({
  root = repoRoot,
  listFiles = listScopeFiles,
  read = (file) => readFileSync(join(root, file), "utf8"),
  write = (line) => console.log(line),
  argv = process.argv.slice(2),
  planned = PLANNED,
  ignoreCheck = (tokens) => gitIgnoredTokens(root, tokens),
  exists = existsSync,
} = {}) {
  const reportOnly = argv.includes("--report-only");
  const { scope, all } = listFiles(root);
  const files = [];
  for (const file of scope) {
    const content = read(file);
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      write(`skipping oversized file (>1 MiB): ${sanitizeForDisplay(file)}`);
      continue;
    }
    files.push({ file, content });
  }
  const result = scanReferences({
    files,
    trackedFiles: all,
    root,
    planned,
    ignoreCheck,
  });

  if (result.stale.length > 0) {
    write(`stale references (${result.stale.length}):`);
    for (const { file, token } of result.stale) {
      write(`${sanitizeForDisplay(file)} -> ${sanitizeForDisplay(token)}`);
    }
  }
  if (result.advisories.length > 0) {
    write(`advisory ambiguous bare names (${result.advisories.length}), never failing:`);
    for (const { file, token, matches } of result.advisories) {
      const shown = matches.slice(0, 5);
      const more = matches.length > shown.length ? ` (+${matches.length - shown.length} more)` : "";
      write(
        `${sanitizeForDisplay(file)} -> ${sanitizeForDisplay(token)} ` +
          `(also at: ${sanitizeForDisplay(shown.join(", "))}${more})`,
      );
    }
  }
  for (const key of Object.keys(planned)) {
    if (exists(join(root, key))) {
      write(`PLANNED entry landed — remove: ${sanitizeForDisplay(key)}`);
    }
  }
  write(
    `checked ${result.checked} path-like reference(s) in ${result.fileCount} file(s): ` +
      `${result.resolved} resolved, ${result.planned} planned (allowlisted), ` +
      `${result.ignored} ignored (gitignored/conditional), ` +
      `${result.stale.length} stale, ${result.advisories.length} advisory`,
  );
  return reportOnly || result.stale.length === 0 ? 0 : 1;
}

/**
 * Internal error exit: --report-only must never fail the CI gate, even
 * when the check itself blows up (git missing, unreadable tree, …).
 */
export function internalErrorExitCode(error, argv = process.argv.slice(2)) {
  console.error(String(error?.stack ?? error));
  return argv.includes("--report-only") ? 0 : 1;
}

// Runs only as a direct CLI entry, never when imported by the gate tests.
// Raw-path comparison: import.meta.url percent-encodes the spaces in this
// repo's location, so a plain string compare silently skips the CLI.
const entry = process.argv[1];
if (entry && realpathSync(entry) === fileURLToPath(import.meta.url)) {
  let code;
  try {
    code = runCheck();
  } catch (error) {
    code = internalErrorExitCode(error);
  }
  process.exit(code);
}
