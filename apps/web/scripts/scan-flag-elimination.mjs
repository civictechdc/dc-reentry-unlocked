/**
 * Flag-elimination scan — the empirical rider gate over the web build output.
 *
 * Mechanism: vite's `define` statically replaces the flag globals in every
 * build — the per-flag `__FLAG_<SCREAMING_SNAKE>__` booleans and the
 * `__DEV_SERVER__` dev-server marker (see `src/lib/flags/`) — so guarded
 * code and the override machinery are supposed to be stripped from the
 * output entirely. This scan is the proof that they were: it walks the
 * client build tree and fails on ANY residual trace of the machinery, plus
 * on any `data-flag=` DOM marker that a flagged control leaked past its
 * guard.
 *
 * Failure signals (both are gate errors):
 * 1. the flag-define identifiers themselves (`__FLAG_` prefix,
 *    `__DEV_SERVER__`) in any file;
 * 2. any `data-flag=` marker attribute in any file.
 *
 * Files are read as plain UTF-8 (invalid bytes become replacement
 * characters), so binary assets never crash the scan — and they cannot hide
 * a hit either, since every needle is plain ASCII. All file extensions are
 * scanned (HTML, JS, CSS, json, …).
 *
 * Scan root: `build/client` resolved from THIS script's location (CWD-
 * independent), or the first CLI argument to point the scan at a fixture
 * tree. Exit codes: 0 clean, 1 elimination failure, 2 scan could not run
 * (missing or unreadable scan root — a scan that proves nothing must not
 * pass).
 */

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Signal 1 needles: the define identifiers must not survive any build. */
export const FLAG_IDENTIFIER_NEEDLES = ["__FLAG_", "__DEV_SERVER__"];

/** Signal 2 needle: the guarded controls' DOM marker. */
export const DATA_FLAG_NEEDLE = "data-flag=";

/** Long minified lines get a window around the match, not the whole bundle. */
const MAX_SNIPPET_CHARS = 200;
/** Exact per-hit detail is capped; the per-signal counts always stay exact. */
const MAX_REPORTED_HITS = 50;

/** The default scan root, resolved from this script — never from the CWD. */
export function defaultScanRoot() {
  return fileURLToPath(new URL("../build/client", import.meta.url));
}

/** Every file in the tree, sorted for stable output; symlinked dirs recurse. */
export function collectFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (statSync(path).isFile()) {
        files.push(path);
      }
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Every occurrence of every needle in the content, as
 * `{ file, line, column, needle, snippet }` records (1-based line/column).
 */
export function findNeedleHits(content, needles, file = "<content>") {
  const hits = [];
  const lines = content.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const needle of needles) {
      let at = line.indexOf(needle);
      while (at !== -1) {
        hits.push({
          file,
          line: index + 1,
          column: at + 1,
          needle,
          snippet: snippetAround(line, at),
        });
        at = line.indexOf(needle, at + needle.length);
      }
    }
  }
  return hits;
}

function snippetAround(line, at) {
  if (line.length <= MAX_SNIPPET_CHARS) return line.trim();
  const half = Math.floor(MAX_SNIPPET_CHARS / 2);
  const start = Math.max(0, at - half);
  const end = Math.min(line.length, start + MAX_SNIPPET_CHARS);
  const body = line.slice(start, end);
  return `${start > 0 ? `…${body}` : body}${end < line.length ? "…" : ""}`;
}

/**
 * Scan a whole tree for both failure signals. Throws when the root is
 * missing or unreadable — the caller decides how that fails.
 */
export function scanTree(root) {
  const files = collectFiles(root);
  const identifierHits = [];
  const markerHits = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    identifierHits.push(...findNeedleHits(content, FLAG_IDENTIFIER_NEEDLES, file));
    markerHits.push(...findNeedleHits(content, [DATA_FLAG_NEEDLE], file));
  }
  return {
    root,
    scannedFiles: files.length,
    identifierHits,
    markerHits,
  };
}

/** Relative, sorted display path — build trees are deep; keep hits readable. */
function displayPath(root, file) {
  const rel = relative(root, file);
  return rel === "" ? file : rel;
}

function printHits(hits, root, label) {
  console.error(`  ${label}:`);
  hits.slice(0, MAX_REPORTED_HITS).forEach((hit) => {
    console.error(`    ✗ ${displayPath(root, hit.file)}:${hit.line}:${hit.column} [${hit.needle}]`);
    console.error(`        ${hit.snippet}`);
  });
  const suppressed = hits.length - MAX_REPORTED_HITS;
  if (suppressed > 0) {
    console.error(`    … ${suppressed} more occurrence(s) suppressed (counts above stay exact)`);
  }
}

// Runs only as a direct CLI entry, never when imported for the exported
// helpers. Raw-path comparison: import.meta.url percent-encodes the spaces
// in this repo's location, so a plain string compare is the reliable check.
const invokedAs = realpathSync(process.argv[1] ?? "");
if (invokedAs === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? defaultScanRoot();
  let result;
  try {
    result = scanTree(root);
  } catch (error) {
    const reason =
      error.code === "ENOENT" ? "does not exist" : `could not be read (${error.message})`;
    console.error(`✗ Flag-elimination scan could not run: scan root ${reason}.`);
    console.error(`  Scan root: ${root} (pass a directory as the first argument to override).`);
    console.error("  A scan that proves nothing must not pass: run `vite build` first.");
    process.exit(2);
  }
  const { root: scannedRoot, scannedFiles, identifierHits, markerHits } = result;
  if (identifierHits.length === 0 && markerHits.length === 0) {
    console.log(
      `✓ Flag-elimination scan clean: ${scannedFiles} file(s) under ${scannedRoot} carry ` +
        "no flag identifiers and no data-flag markers.",
    );
  } else {
    console.error(
      `✗ Flag-elimination scan FAILED over ${scannedRoot} (${scannedFiles} file(s) scanned):`,
    );
    if (identifierHits.length > 0) {
      printHits(identifierHits, scannedRoot, `${identifierHits.length} flag-identifier hit(s)`);
    }
    if (markerHits.length > 0) {
      printHits(markerHits, scannedRoot, `${markerHits.length} data-flag marker hit(s)`);
    }
    console.error(
      `Summary: ${identifierHits.length} flag-identifier occurrence(s), ` +
        `${markerHits.length} data-flag marker occurrence(s). ` +
        "Flag code and markers must be stripped from every build.",
    );
    process.exit(1);
  }
}
