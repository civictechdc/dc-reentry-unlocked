/**
 * Diagram check (the renderability gate for the architecture diagrams).
 *
 * Mechanism: the mermaid blocks inside the committed Markdown are the
 * diagram-as-code source of truth — there is no separate .mmd file to keep
 * in sync (extraction over a sync script, 2026-10-31). This script scans
 * docs/*.md and README.md for ```mermaid fenced blocks, renders each one
 * with mermaid-cli, and exits non-zero if any block fails to render, so a
 * CI job can validate renderability of every diagram exactly as committed.
 *
 * Fail-closed rules (both are gate errors, not warnings):
 * - an unterminated ```mermaid fence anywhere in a scanned file aborts the
 *   run (a diagram that vanishes from validation must fail the gate);
 * - zero blocks across all scanned files aborts the run.
 *
 * Toolchain pairing: mermaid-cli and puppeteer are pinned TOGETHER so the
 * dlx resolution is deterministic (mermaid-cli's `puppeteer` peer otherwise
 * drifts to latest). The renderer's chrome-headless-shell install in CI
 * (`pnpm dlx puppeteer@<version> browsers install chrome-headless-shell`,
 * .github/workflows/pr.yml) must pair with PUPPETEER_VERSION; when either
 * version changes, change both here and the CI step.
 *
 * The renderer needs no output artifact: SVG files land in a temp directory
 * and are removed in a finally block, so exceptional failures leave no
 * residue behind.
 */

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MERMAID_CLI_VERSION = "12.0.0";
export const PUPPETEER_VERSION = "25.16.0";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Extract the contents of every ```mermaid fenced block, in file order.
 * Throws on an unterminated mermaid fence — an open block is a gate error,
 * not silently-dropped content.
 */
export function parseMermaidBlocks(markdown, fileName = "<markdown>") {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);
  let inside = false;
  let current = [];
  for (const line of lines) {
    if (!inside) {
      if (/^\s*```\s*mermaid\s*$/.test(line)) {
        inside = true;
        current = [];
      }
    } else if (/^\s*```\s*$/.test(line)) {
      blocks.push(current.join("\n"));
      inside = false;
    } else {
      current.push(line);
    }
  }
  if (inside) {
    throw new Error(
      `${fileName}: unterminated \`\`\`mermaid fence at end of file — close it so the diagram content is validated and rendered`,
    );
  }
  return blocks;
}

/** The gate refuses to prove a negative: zero diagrams is a mis-scan. */
export function assertHasDiagrams(blockCount) {
  if (blockCount === 0) {
    throw new Error("No mermaid blocks found — nothing to validate, treat as suspicious.");
  }
}

function collectMarkdownFiles() {
  const files = [join(repoRoot, "README.md")];
  const docsDir = join(repoRoot, "docs");
  for (const entry of readdirSync(docsDir)) {
    const path = join(docsDir, entry);
    if (statSync(path).isFile() && entry.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

// Both packages pinned together: a single dlx runs only the first package's
// bin and passes its second argument through as ARGV, so the deterministic
// pairing needs explicit package switches — `npx -p <pkg>@<version>` per
// package, ending with the bin name (mermaid-cli's bin is mmdc). The
// combined env resolves mermaid-cli's `puppeteer ^25.0.0` peer to exactly
// PUPPETEER_VERSION; the renderer's chrome-headless-shell install in CI
// (pnpm dlx puppeteer@<that version> browsers install chrome-headless-shell,
// .github/workflows/pr.yml) pairs with it.
const mermaidCli = [
  "npx",
  [
    "-y",
    "-p",
    `@mermaid-js/mermaid-cli@${MERMAID_CLI_VERSION}`,
    "-p",
    `puppeteer@${PUPPETEER_VERSION}`,
    "mmdc",
  ],
];

function renderBlock(source, index, file, tmp) {
  const stem = `${basename(file, ".md")}-${index}.mmd`;
  const input = join(tmp, stem);
  const output = join(tmp, `${stem}.svg`);
  writeFileSync(input, `${source}\n`);
  const [cmd, args] = mermaidCli;
  return spawnSync(cmd, [...args, "-i", input, "-o", output], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
  });
}

// Runs only as a direct CLI entry, never when imported by the gate tests.
// Raw-path comparison: import.meta.url percent-encodes the spaces in this
// repo's location, so a plain string compare silently skips the CLI.
const invokedAs = realpathSync(process.argv[1] ?? "");
if (invokedAs === fileURLToPath(import.meta.url)) {
  let exitCode = 0;
  const tmp = mkdtempSync("diagram-check-");
  try {
    let rendered = 0;
    let failed = 0;

    for (const file of collectMarkdownFiles()) {
      const blocks = parseMermaidBlocks(readFileSync(file, "utf8"), basename(file));
      blocks.forEach((source, index) => {
        rendered += 1;
        const result = renderBlock(source, index, file, tmp);
        if (result.status === 0) {
          console.log(`✓ ${basename(file)} [${index}] renders`);
        } else {
          failed += 1;
          console.error(`✗ ${basename(file)} [${index}] failed to render`);
          console.error(String(result.stderr));
        }
      });
    }

    assertHasDiagrams(rendered);
    console.log(
      `\n${rendered} diagram block(s) rendered${failed === 0 ? "" : `, ${failed} failed`}`,
    );
    if (failed !== 0) exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(exitCode);
}
