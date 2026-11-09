/**
 * Types for the plain-JS flag-elimination scan script (`scan-flag-elimination.mjs`),
 * so test files can import its exported helpers type-safely. Keep in sync with
 * the script's exports.
 */

/** One needle occurrence: 1-based `line`/`column`, plus a control-character-sanitized snippet. */
export interface ScanHit {
  file: string;
  line: number;
  column: number;
  needle: string;
  snippet: string;
}

/** The result of scanning a whole tree for both failure signals. */
export interface ScanResult {
  root: string;
  scannedFiles: number;
  identifierHits: ScanHit[];
  markerHits: ScanHit[];
}

/** Signal 1 needles: the define identifiers must not survive any build. */
export const FLAG_IDENTIFIER_NEEDLES: readonly string[];
/** Signal 2 needle: the guarded controls' DOM marker. */
export const DATA_FLAG_NEEDLE: string;

/** The default scan root, resolved from the script's own location — never the CWD. */
export function defaultScanRoot(): string;

/** Every file in the tree, sorted; symlinks are skipped and walk depth is capped. */
export function collectFiles(root: string): string[];

/** Every occurrence of every needle in the content, as `{ file, line, column, needle, snippet }` records. */
export function findNeedleHits(
  content: string,
  needles: readonly string[],
  file?: string,
): ScanHit[];

/** Scan a whole tree for both failure signals; throws when the root is missing or unreadable. */
export function scanTree(root: string): ScanResult;
