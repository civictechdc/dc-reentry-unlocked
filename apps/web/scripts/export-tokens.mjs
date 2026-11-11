import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regenerate (or verify) the committed generated token stylesheet from
 * DESIGN.md through the exactly-pinned @google/design.md CLI. Only this
 * script's export mode writes files; check mode is read-only.
 *
 * Modes:
 *   node scripts/export-tokens.mjs          regenerate the committed artifact
 *   node scripts/export-tokens.mjs --check  capture a fresh export in memory
 *                                           and require the committed artifact
 *                                           to be git-tracked and byte-identical
 */

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESIGN_MD = join(WEB_ROOT, "DESIGN.md");
const GENERATED = join(WEB_ROOT, "src", "generated", "design-tokens.css");
const PINNED_CLI = join(WEB_ROOT, "node_modules", "@google", "design.md", "dist", "index.js");

/**
 * Runs the pinned CLI's css-vars export and returns stdout. The exact
 * version pin freezes the CLI surface: css-vars emits a single `:root`
 * block, `--color-*`/`--spacing-*`/`--rounded-*` with dots flattened to
 * hyphens, references resolved to literal lowercase hex, and no
 * typography, elevation, or component declarations. No `--prefix`.
 *
 * @param {{
 *   cliPath?: string,
 *   designPath?: string,
 *   spawn?: (file: string, args: string[], options: object) => object,
 * }} [options]
 * @returns {string} the exported css-vars text
 */
export function runCssVarsExport({
  cliPath = PINNED_CLI,
  designPath = DESIGN_MD,
  spawn = (file, args, options) => spawnSync(file, args, options),
} = {}) {
  if (!existsSync(cliPath)) {
    throw new Error(`pinned exporter missing: ${cliPath}`);
  }
  const result =
    /** @type {{ status?: number | null, stdout?: unknown, stderr?: unknown, error?: unknown }} */ (
      spawn(process.execPath, [cliPath, "export", "--format", "css-vars", designPath], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      })
    );
  if (result.error) {
    throw new Error(`exporter failed to run: ${String(result.error)}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `exporter exited ${result.status}${result.stderr ? `: ${String(result.stderr)}` : ""}`,
    );
  }
  return typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? "");
}

/**
 * True when the given repo-relative path has a git index entry.
 *
 * @param {string} relativePath
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function isGitTracked(relativePath, cwd = WEB_ROOT) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd,
    encoding: "utf8",
  });
  return result.status === 0;
}

/**
 * The check decision, pure and injection-driven so tests can exercise every
 * failure mode without a repository: an untracked artifact, a tracked-but-
 * missing artifact, and a byte-divergent artifact each fail with the fix in
 * the message. `committedContent` is null when the artifact is absent.
 *
 * @param {{
 *   freshContent: Buffer,
 *   committedContent: Buffer | null,
 *   tracked: boolean,
 * }} inputs
 * @returns {{ ok: boolean, reason: string }}
 */
export function checkExport({ freshContent, committedContent, tracked }) {
  if (!tracked) {
    return {
      ok: false,
      reason:
        "src/generated/design-tokens.css has no git index entry (untracked or never committed)",
    };
  }
  if (committedContent === null) {
    return {
      ok: false,
      reason: "src/generated/design-tokens.css is tracked but missing on disk",
    };
  }
  if (!committedContent.equals(freshContent)) {
    return {
      ok: false,
      reason:
        "src/generated/design-tokens.css differs from a fresh export — regenerate with `pnpm -C apps/web design:export`, never hand-edit",
    };
  }
  return {
    ok: true,
    reason: "generated token stylesheet is tracked and byte-identical to a fresh export",
  };
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const css = runCssVarsExport();

  if (!checkMode) {
    mkdirSync(dirname(GENERATED), { recursive: true });
    writeFileSync(GENERATED, css);
    console.log(`regenerated ${GENERATED} (${css.length} bytes)`);
    process.exit(0);
  }

  // Local intent-to-add staging (`git add -N`) satisfies this tracked check
  // without a commit — a deliberate local staging act; CI checks out HEAD,
  // where the committed artifact is what the index reports.
  const tracked = isGitTracked("src/generated/design-tokens.css");
  const committedContent = existsSync(GENERATED) ? readFileSync(GENERATED) : null;
  const verdict = checkExport({ freshContent: Buffer.from(css), committedContent, tracked });
  if (!verdict.ok) {
    console.error(`design export check FAILED: ${verdict.reason}`);
    process.exit(1);
  }
  console.log(verdict.reason);
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);

if (invokedDirectly) await main();
