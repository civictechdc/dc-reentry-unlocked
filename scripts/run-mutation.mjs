/**
 * Mutation testing orchestrator (manual dispatch, `.github/workflows/full.yml`).
 *
 * Runs StrykerJS sequentially in the three mutation scopes —
 * packages/shared, apps/api, tools/datagen — each with its own
 * stryker.config.json. Report-only: every config sets `thresholds.break:
 * null`, so mutant scores are observations, not gate failures; a run only
 * fails when Stryker itself errors out.
 *
 * In-place mutation rewrites the scope's tracked files and restores them
 * afterwards. The safety contract around that:
 * - PREFLIGHT (fail fast, never destroy): before each scope, its tracked
 *   files must have no unstaged modifications — including staged-then-
 *   edited files (the worktree half of those would be destroyed). Untracked
 *   files are allowed (`git restore` never deletes untracked files; the
 *   sweeper below only removes Stryker's own setup leftovers). A dirty
 * scope aborts the whole orchestrator with the offending paths listed.
 * - POST-RUN (residue only): after each scope, any worktree difference is
 *   mutation residue — restore and fail. A failed hygiene probe itself is
 *   also a failure (fail closed), never a silent pass.
 *
 * pnpm resolution notes (verified 2026-10-31): the Stryker binaries come from
 * the repo root `node_modules/.bin`; the plugin chain resolves inside
 * Stryker's injected packageExtensions context — see the
 * `@stryker-mutator/core@10.1.1` block in `pnpm-workspace.yaml` for why the
 * checker runs on the TS 6 compiler. Dev tooling only; never on the runtime
 * import path of any workspace.
 */

import { execFile, spawnSync } from "node:child_process";
import { readdirSync, realpathSync, unlinkSync } from "node:fs";
import { promisify } from "node:util";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const strykerBin = join(repoRoot, "node_modules", ".bin", "stryker");

const scopes = [
  ["shared", "packages/shared"],
  ["api", "apps/api"],
  ["datagen", "tools/datagen"],
];

/**
 * Run `git …` inside the repo. Returns a result object instead of a
 * process object so tests can stub the runner: { ok, stdout, stderr } —
 * git failures are surfaced, never swallowed.
 */
export function createGitRunner(options = {}) {
  return async function runGit(args) {
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd: options.cwd ?? repoRoot,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
      });
      return { ok: true, stdout, stderr };
    } catch (error) {
      return {
        ok: false,
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? String(error),
      };
    }
  };
}

/**
 * Tracked files with unstaged worktree modifications inside `dir`
 * (relative to the paths git prints: pass the scope path as git would see
 * it). Untracked files are not reported — `git restore` cannot destroy
 * them, so they are irrelevant to the destructive-cleanup risk.
 */
export async function dirtyTrackedFiles(dir, runGit = createGitRunner()) {
  const result = await runGit(["diff", "--name-only", "--", dir]);
  if (!result.ok) {
    return { ok: false, error: `git diff failed: ${result.stderr.trim()}` };
  }
  const files = result.stdout.split("\n").filter((line) => line.trim() !== "");
  return { ok: true, files };
}

/**
 * Preflight: refuse to mutate a scope whose tracked files carry unstaged
 * edits (fail fast, never destroy pre-existing work). Staged-but-not-committed
 * files are safe: `git restore -- <path>` resets the worktree from the
 * index, so staged content survives cleanup.
 */
export async function assertPreflightClean(dir, runGit) {
  const probed = await dirtyTrackedFiles(dir, runGit ?? createGitRunner());
  if (!probed.ok) {
    throw new Error(`cannot verify mutation scope "${dir}" is clean — ${probed.error}`);
  }
  if (probed.files.length > 0) {
    throw new Error(
      `refusing to run in-place mutation in "${dir}" — tracked files with unstaged changes would be destroyed by cleanup. ` +
        `Commit or stash them first. Offending files: ${probed.files.join(", ")}`,
    );
  }
}

/** Stryker leaves worker setup files beside the sources after in-place runs. */
export function sweepStrykerArtifacts(dir, base = repoRoot) {
  let touched = 0;
  try {
    for (const entry of readdirSync(join(base, dir))) {
      if (/^stryker-setup-\d+\.js$/.test(entry)) {
        unlinkSync(join(base, dir, entry));
        touched += 1;
      }
    }
  } catch {
    // best-effort sweep; never fail the run over it
  }
  return touched;
}

/**
 * Post-run: the preflight guaranteed a clean start, so any worktree
 * difference is mutation residue — restore it and fail. A git probe error
 * fails closed: silently passing a cleanliness check is not an option.
 */
export async function assertCleanup(dir, runGit = createGitRunner()) {
  const probed = await dirtyTrackedFiles(dir, runGit);
  if (!probed.ok) {
    throw new Error(
      `cannot verify mutation residue in "${dir}" — ${probed.error} ` +
        `Inspect ${dir} manually before the next mutation run.`,
    );
  }
  if (probed.files.length > 0) {
    console.error(
      `mutation run left modified tracked files in ${dir}: ${probed.files.join(", ")} — restoring.`,
    );
    const restore = await runGit(["restore", "--", dir]);
    if (!restore.ok) {
      throw new Error(
        `mutation residue in "${dir}" could not be restored automatically (${restore.stderr.trim()}) — ` +
          `restore ${probed.files.join(", ")} manually.`,
      );
    }
    throw new Error(`mutant cleanup assertion failed for ${dir}; residue files restored`);
  }
}

const invokedAs = realpathSync(process.argv[1] ?? "");
// compare raw paths (fileURLToPath decodes the %20 style escapes that
// path-with-spaces URLs carry — a plain string compare against
// import.meta.url silently skips the main body for this repo)
if (invokedAs === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (cause) {
    console.error(
      `\nMutation orchestration aborted: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    process.exit(1);
  }
}

async function main() {
  let failed = 0;
  for (const [name, dir] of scopes) {
    await assertPreflightClean(dir);
    console.log(`\n=== mutation: ${name} (${dir}) ===`);
    const result = spawnSync(strykerBin, ["run"], {
      cwd: join(repoRoot, dir),
      env: {
        ...process.env,
        PATH: `${join(repoRoot, "node_modules", ".bin")}:${process.env.PATH}`,
      },
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.error(`\n=== mutation: ${name} FAILED (exit ${result.status}) ===`);
      sweepStrykerArtifacts(dir);
      failed += 1;
      continue;
    }
    sweepStrykerArtifacts(dir);
    await assertCleanup(dir);
  }

  console.log(
    failed === 0
      ? "\nAll mutation runs completed (report-only thresholds)."
      : `\n${failed} mutation run(s) failed.`,
  );
  if (failed !== 0) {
    process.exit(1);
  }
}
