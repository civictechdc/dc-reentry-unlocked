/**
 * Svelte preprocessor: strips every `{#if}` block whose condition references
 * a `__FLAG_<NAME>__` define constant, before Svelte compiles.
 *
 * Why it exists: Svelte 5 compiles `{#if}` branches as live closure
 * arguments to its runtime, so the folded-false defines (see
 * `./README.md`) eliminate the flag JS machinery but NOT the branch
 * closures or their template fragments — a guarded control's `data-flag=`
 * marker survives as a dead string and fails the build-output elimination
 * scan (`scripts/scan-flag-elimination.mjs`). Stripping the whole guarded
 * block at parse time removes the fragment too.
 *
 * Scope: wired into `vite.config.ts` for every NON-dev-server compile only
 * (the same `isDevServerRun` predicate that keys the defines). Dev-server
 * runs and Vitest compile the unchanged source, keeping the full runtime
 * override machinery testable. What strips is strict: exactly the blessed
 * guard shape (`__FLAG_<NAME>__ || (__DEV_SERVER__ && hasFlagOverride(…))`)
 * or a bare `__FLAG_<NAME>__` identifier — any other condition referencing
 * a flag define (a negation, a mixed disjunction, a swapped arm, …), and
 * any guarded block carrying an `{:else}`/`{:else if}` branch, is a loud
 * error here, never a silent partial strip.
 */
import { parse } from "svelte/compiler";
import type { PreprocessorGroup } from "svelte/compiler";

/** The naming contract for define constants (`flag-globals.d.ts`): SCREAMING_SNAKE_CASE. */
const FLAG_IDENTIFIER_PATTERN = /^__FLAG_[A-Z0-9_]+__$/;

/** The dev-server marker define, exactly as it appears in the blessed shape. */
const DEV_SERVER_MARKER = "__DEV_SERVER__";

/** The page-load override helper, exactly as the blessed shape calls it. */
const OVERRIDE_HELPER = "hasFlagOverride";

/** Minimal structural shape of an AST node — offsets are all we rely on. */
interface SvelteNode {
  type: string;
  start?: number;
  end?: number;
  [key: string]: unknown;
}

interface FlaggedBlock {
  /** `[start, end)` source range of the whole `{#if}…{/if}` block. */
  start: number;
  end: number;
  /** The flag identifiers its condition references, for error messages. */
  flags: string[];
}

/** Depth-first walk over any AST value: arrays recurse, nodes recurse, primitives end. */
function visitNodes(value: unknown, visit: (node: SvelteNode) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visitNodes(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as SvelteNode;
  visit(node);
  for (const [key, child] of Object.entries(node)) {
    // Svelte's walker attaches parent pointers at runtime; parse output is a
    // plain tree, so the skip is defensive only.
    if (key === "parent") continue;
    visitNodes(child, visit);
  }
}

/** Every identifier in an expression subtree matching the define-name contract. */
function flagIdentifiersIn(expression: unknown): string[] {
  const names: string[] = [];
  visitNodes(expression, (node) => {
    if (node.type === "Identifier" && typeof node["name"] === "string") {
      if (FLAG_IDENTIFIER_PATTERN.test(node["name"])) names.push(node["name"]);
    }
  });
  return names;
}

/** An `Identifier` node whose name satisfies the define-name contract. */
function isFlagIdentifier(node: SvelteNode | undefined): boolean {
  return (
    node?.type === "Identifier" &&
    typeof node["name"] === "string" &&
    FLAG_IDENTIFIER_PATTERN.test(node["name"])
  );
}

/**
 * The blessed guard shape, structurally exact: `__FLAG_<NAME>__ ||
 * (__DEV_SERVER__ && hasFlagOverride(…))`. Only this shape folds to `false`
 * in every build with production semantics matching a full-block strip.
 */
function isBlessedGuardShape(test: SvelteNode): boolean {
  if (test.type !== "LogicalExpression" || test["operator"] !== "||") return false;
  const left = test["left"] as SvelteNode | undefined;
  const right = test["right"] as SvelteNode | undefined;
  if (!isFlagIdentifier(left)) return false;
  if (right?.type !== "LogicalExpression" || right["operator"] !== "&&") return false;
  const overrideCall = right["right"] as SvelteNode | undefined;
  const callee = overrideCall?.["callee"] as SvelteNode | undefined;
  const devMarker = right["left"] as SvelteNode | undefined;
  return (
    devMarker?.type === "Identifier" &&
    devMarker["name"] === DEV_SERVER_MARKER &&
    overrideCall?.type === "CallExpression" &&
    callee?.type === "Identifier" &&
    callee["name"] === OVERRIDE_HELPER
  );
}

/**
 * A bare `__FLAG_<NAME>__` identifier guard: the define folds to `false` in
 * every build, so stripping the whole block is exactly what production does.
 */
function isBareFlagIdentifier(test: SvelteNode): boolean {
  return isFlagIdentifier(test);
}

/** The offending condition's own source text, for loud-error messages. */
function conditionSlice(source: string, test: SvelteNode): string {
  if (typeof test.start === "number" && typeof test.end === "number") {
    return source.slice(test.start, test.end);
  }
  return "<condition source unavailable>";
}

/**
 * Remove every `[start, end)` range from `source`, highest offset first so
 * earlier offsets stay valid. Only OUTERmost ranges are passed in — inner
 * blocks vanish with their enclosing stripped block.
 */
function removeRanges(source: string, ranges: Array<{ start: number; end: number }>): string {
  let result = source;
  for (const { start, end } of [...ranges].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, start) + result.slice(end);
  }
  return result;
}

/**
 * Strip every flag-guarded `{#if}` block from `source`, outermost blocks
 * only (guarded blocks nested inside another guarded block disappear with
 * it). Sources with no flag-guarded block come back byte-identical.
 *
 * Stripping keys on the condition shape, not on a flag identifier merely
 * appearing: a block strips only when its test is exactly the blessed
 * shape (see `./README.md`) or a bare `__FLAG_<NAME>__` identifier. Any
 * other test referencing a flag define — a negation, a comparison, a
 * mixed disjunction, an out-of-shape `hasFlagOverride` call — throws a
 * loud error naming the file and the offending condition, because its
 * production semantics (often "render") must not be silently deleted.
 *
 * Also throws on a guarded block carrying an `{:else}`/`{:else if}`
 * branch — the blessed guard shape has no else, and an `{:else if}`
 * chain would leave dangling markup behind a partial strip.
 */
export function stripGuardedFlagBlocks(source: string, filename?: string): string {
  // `modern: true` — the typed AST (Svelte 6's default shape): IfBlock
  // nodes carry `test`/`alternate` plus `start`/`end` source offsets.
  const ast = parse(source, filename ? { filename, modern: true } : { modern: true });
  const flagged: FlaggedBlock[] = [];
  visitNodes(ast, (node) => {
    if (node.type !== "IfBlock") return;
    const flags = flagIdentifiersIn(node["test"]);
    if (flags.length === 0) return;
    const where = filename ?? "<unknown file>";
    if (node["alternate"] != null || node["elseif"] === true) {
      throw new Error(
        `Flag-guarded {#if} block in ${where} has an {:else}/{:else if} branch ` +
          `(${flags.join(", ")}). The blessed guard shape has no else — ` +
          "unguard the fallback branch or move the flag to its own block.",
      );
    }
    const test = node["test"] as SvelteNode;
    if (!isBlessedGuardShape(test) && !isBareFlagIdentifier(test)) {
      throw new Error(
        `Flag guard in ${where} references a flag define outside the blessed shape: ` +
          `\`${conditionSlice(source, test)}\`. Only the exact blessed shape — ` +
          `\`${"__FLAG_<NAME>__"} || (${DEV_SERVER_MARKER} && ${OVERRIDE_HELPER}("<name>"))\` — ` +
          "or a bare `__FLAG_<NAME>__` identifier strips; any other condition referencing " +
          "a flag define fails the build here (see src/lib/flags/README.md, " +
          "“The blessed guard shape”).",
      );
    }
    if (typeof node.start !== "number" || typeof node.end !== "number") {
      throw new Error(`Flag-guarded {#if} block in ${where} lacks source offsets.`);
    }
    flagged.push({ start: node.start, end: node.end, flags });
  });
  if (flagged.length === 0) return source;
  // Keep only outermost ranges: after sorting by start, a later range is
  // nested exactly when it starts inside the last kept range (same-tree
  // block ranges can only nest, never partially overlap).
  const outermost: Array<{ start: number; end: number }> = [];
  for (const range of flagged.sort((a, b) => a.start - b.start)) {
    const enclosing = outermost.at(-1);
    if (enclosing && range.start < enclosing.end) continue;
    outermost.push(range);
  }
  return removeRanges(source, outermost);
}

/**
 * The preprocessor group wired into `vite.config.ts`'s `sveltekit()` options
 * for non-dev-server compiles. Markup hook only — guarded scripts need no
 * stripping (define folding + dead-code elimination already handles JS).
 */
export const stripFlagGuardedBlocksPreprocessor: PreprocessorGroup = {
  name: "strip-flag-guarded-blocks",
  markup: ({ content, filename }) => ({ code: stripGuardedFlagBlocks(content, filename) }),
};
