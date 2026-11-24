/**
 * Tracking-reference check (the deterministic gate behind the AGENTS.md
 * rule "No OpenSpec-internal tracking references in committed files").
 *
 * Mechanism: committed text files must not reference OpenSpec-internal
 * tracking — task numbers (the word task/tasks/lands followed by a dotted
 * number), block numbers (the word block/blocks followed by a number),
 * design-decision IDs (a bare uppercase D + digits token — lowercase
 * d-fragments stay invisible), or change names derived DYNAMICALLY from
 * the directories under openspec/changes/ (active dirs verbatim, archived
 * `<date>-<name>` dirs by their name part) — unless the name is also a
 * main-spec directory under openspec/specs/, because such a name denotes
 * the capability, not the change. Such refs
 * dangle for fresh clones and go stale on renumber. This gate replaces
 * the AGENTS.md starter grep, whose decision-ID alternation only reached
 * the double-digit IDs and missed the single-digit ones.
 *
 * Scope: every text file git knows about — tracked plus untracked-not-
 * ignored (`git ls-files -co --exclude-standard`) — minus openspec/ (the
 * planning workspace where the references live), the lockfile, the frozen
 * data/ dataset, binaries (extension deny-list plus a NUL-byte sniff),
 * `.agents/skills/` (pinned upstream skill content that must stay
 * byte-identical to upstream; drift there is the skills-lock's job), and
 * `docs/feedback/` (dated, user-signed walkthrough records — historical
 * snapshots, like the commit messages the rule already exempts).
 *
 * Markdown fenced code blocks are skipped entirely — backtick and tilde
 * fences alike: fences hold copy-paste commands and rule examples (the
 * AGENTS.md grep itself), not prose, and a marker inside a fenced shell
 * command would corrupt it. A fence left open is reported as a notice
 * (the remainder of that file is not scanned) and never fails the gate.
 *
 * Task/block shapes match case-insensitively (sentence-initial "Task"
 * must hit like mid-sentence "task"); decision IDs are uppercase by
 * convention and match only uppercase D + digits, so lowercase d1/d3
 * fragments (library names, anchors) stay invisible. An uppercase
 * decision-ID-shaped library name still collides — mechanically
 * indistinguishable — and needs the escape hatch below.
 *
 * Escape hatch: a line containing `tracking-ref-allow` is skipped — for
 * the rule's own documentation and the rare legitimate mention.
 *
 * Deterministic output: hits sorted by file, line, then offset (one
 * report per line — the marker is line-scoped), values sanitized at the
 * print layer; exit 1 on any hit with a one-line pointer to the rule,
 * exit 0 with a one-line summary when clean. Plain Node ESM, zero npm
 * dependencies, run from the repo root — same mold as
 * scripts/check-references.mjs.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, lstatSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeForDisplay } from "./check-references.mjs";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const GIT_SPAWN_LIMITS = { maxBuffer: 16 * 1024 * 1024, timeout: 30000 };
const MAX_FILE_BYTES = 1024 * 1024;

/** Line-level escape hatch: anywhere in the line skips it. */
export const ALLOW_MARKER = "tracking-ref-allow";

const GIT_SPAWN = { encoding: "utf8", ...GIT_SPAWN_LIMITS };

/** Tracked + untracked-not-ignored, NUL-separated (byte-exact paths). */
export function gitListAllFiles(root) {
  const result = spawnSync(
    "git",
    ["-C", root, "ls-files", "-z", "-co", "--exclude-standard"],
    GIT_SPAWN,
  );
  if (result.error || result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.error}`);
  }
  return result.stdout.split("\0").filter(Boolean);
}

/** Path scope: the rule's exemptions plus generated/pinned content. */
export function isScannablePath(path) {
  if (path === "pnpm-lock.yaml") return false;
  if (path.startsWith("openspec/") || path.startsWith("data/")) return false;
  if (path.startsWith(".agents/skills/")) return false; // pinned upstream
  if (path.startsWith("docs/feedback/")) return false; // dated, user-signed records
  return !BINARY_EXTENSIONS.test(path);
}

const BINARY_EXTENSIONS =
  /\.(?:png|jpe?g|gif|webp|ico|icns|pdf|woff2?|ttf|otf|eot|mp4|webm|zip|gz|tgz|wasm|node)$/;

/** NUL byte anywhere in the first kilobyte: binary, skip silently. */
export function looksBinary(buffer) {
  return buffer.subarray(0, 1024).includes(0);
}

/**
 * Change names from the openspec/changes directory entries (one level):
 * active dirs verbatim, archived `<date>-<name>` dirs by their name
 * part. Pure over the entry list so tests need no repo state.
 */
export function extractChangeNames(entries) {
  const names = [];
  for (const entry of entries) {
    if (entry === "archive") continue;
    if (/^\d{4}-\d{2}-\d{2}-(.+)$/.test(entry)) {
      names.push(entry.replace(/^\d{4}-\d{2}-\d{2}-/, ""));
      continue;
    }
    names.push(entry);
  }
  // longest first: the combined alternation must prefer the whole
  // identifier over any shorter name it contains
  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

/**
 * Change names that denote the CHANGE, not a capability: a name that is
 * also a main-spec directory under openspec/specs/ denotes the capability
 * (a legitimate identifier to reference anywhere) and is dropped. Pure
 * over the two entry lists so tests need no repo state.
 */
export function changeNamesWithoutCapabilities(changeEntries, specEntries) {
  const capabilities = new Set(specEntries);
  return extractChangeNames(changeEntries).filter((name) => !capabilities.has(name));
}

export function listChangeNames(root = repoRoot, lists = null) {
  if (lists !== null) {
    return changeNamesWithoutCapabilities(lists.changes, lists.specs);
  }
  const changesDir = join(root, "openspec", "changes");
  const dirNames = (dir) => {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    } catch {
      return [];
    }
  };
  return changeNamesWithoutCapabilities(
    [...dirNames(changesDir), ...dirNames(join(changesDir, "archive"))],
    dirNames(join(root, "openspec", "specs")),
  );
}

export const TASK_NUMBER_PATTERN = /\b(?:tasks?|lands?)\s+[0-9]+\.[0-9]+\b/gi;
export const BLOCK_NUMBER_PATTERN = /\bblocks?\s+[0-9]+\b/gi;
// Decision IDs are uppercase by convention: lowercase d1/d3 shapes are
// library names and fragments, not decision references.
export const DECISION_ID_PATTERN = /\bD[0-9]+\b/g;

/**
 * Whole-identifier alternation over the change names: a hit must not be
 * flanked by further identifier characters (including underscore), so a
 * full change name hits but a longer word or compound containing it does
 * not.
 */
export function buildChangeNamePattern(names) {
  if (names.length === 0) return null;
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![a-zA-Z0-9_-])(?:${escaped.join("|")})(?![a-zA-Z0-9_-])`, "gi");
}

const FENCE_PREFIX = /^\s*(?:```|~~~)/;

/**
 * The scan over already-read text. Pure over its inputs: files are
 * `{ file, content }` pairs with repo-relative display paths. One report
 * per line (first match wins the display), ordered by file, then line.
 * Markdown fences are skipped per file — backtick or tilde, closed only
 * by the same marker — and a fence left open is reported in `unclosed`
 * (the remainder of that file was not scanned).
 */
export function scanFiles({ files, changeNames }) {
  const changeNamePattern = buildChangeNamePattern(changeNames);
  const patterns = [TASK_NUMBER_PATTERN, BLOCK_NUMBER_PATTERN, DECISION_ID_PATTERN];
  if (changeNamePattern !== null) patterns.push(changeNamePattern);
  const hits = [];
  const unclosed = [];
  for (const { file, content } of files) {
    const fenced = file.endsWith(".md");
    let openFenceMarker = null;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (fenced && FENCE_PREFIX.test(line)) {
        const marker = line.trim().startsWith("~~~") ? "~~~" : "```";
        openFenceMarker = openFenceMarker === marker ? null : (openFenceMarker ?? marker);
        continue;
      }
      if (openFenceMarker !== null) continue;
      if (line.includes(ALLOW_MARKER)) continue;
      const matches = [];
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        for (const match of line.matchAll(pattern)) {
          matches.push({ index: match.index, text: match[0] });
        }
      }
      if (matches.length === 0) continue;
      matches.sort((a, b) => a.index - b.index);
      hits.push({ file, line: index + 1, text: matches[0].text });
    }
    if (openFenceMarker !== null) unclosed.push(file);
  }
  return { hits, unclosed };
}

/**
 * Full check: discover, read, scan, print. Returns the exit code — 1 on
 * any hit, 0 when clean. Unreadable or binary files are skipped with a
 * deterministic count in the summary.
 */
export function runCheck({
  root = repoRoot,
  listFiles = gitListAllFiles,
  changeNames = listChangeNames(root),
  read = (file) => readFileSync(join(root, file)),
  lstat = lstatSync,
  write = (line) => console.log(line),
} = {}) {
  const scannable = [];
  let binaryCount = 0;
  for (const file of listFiles(root).filter(isScannablePath)) {
    try {
      // Directories and symlinks-to-elsewhere are not scannable content
      // (same guard as scripts/check-references.mjs's regular-file filter).
      if (!lstat(join(root, file)).isFile()) continue;
    } catch {
      continue;
    }
    let content;
    try {
      content = read(file);
    } catch {
      binaryCount += 1; // vanished or unreadable: skip deterministically
      continue;
    }
    if (looksBinary(content)) {
      binaryCount += 1;
      continue;
    }
    if (content.byteLength > MAX_FILE_BYTES) {
      write(`skipping oversized file (>1 MiB): ${sanitizeForDisplay(file)}`);
      continue;
    }
    scannable.push({ file, content: content.toString("utf8") });
  }
  const { hits, unclosed } = scanFiles({ files: scannable, changeNames });
  for (const file of unclosed) {
    write(`notice: unclosed fence in ${sanitizeForDisplay(file)}; remainder not scanned`);
  }
  if (hits.length > 0) {
    write(`tracking references outside openspec/ (${hits.length}):`);
    for (const { file, line, text } of hits) {
      write(`${sanitizeForDisplay(file)}:${line}: ${sanitizeForDisplay(text)}`);
    }
    write(
      `see the "No OpenSpec-internal tracking references in committed files" rule in AGENTS.md ` +
        `(line escape hatch: ${ALLOW_MARKER})`,
    );
    return 1;
  }
  write(
    `checked ${scannable.length} file(s), ${binaryCount} binary/unreadable skipped: ` +
      `no OpenSpec-internal tracking references outside openspec/`,
  );
  return 0;
}

// Runs only as a direct CLI entry, never when imported by the gate tests.
// Raw-path comparison: import.meta.url percent-encodes the spaces in this
// repo's location, so a plain string compare silently skips the CLI.
const entry = process.argv[1];
if (entry && realpathSync(entry) === fileURLToPath(import.meta.url)) {
  process.exit(runCheck());
}
