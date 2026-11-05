# Design — dev-containers

Confirmed with the user 2026-11-05 after a sourced survey of the dev
container spec (containers.dev), VS Code/Zed/Codespaces docs, the
devcontainers image catalog, Playwright docs, and Node corepack docs.

## Decisions

1. **Base: plain `image`, no Compose, no repo Dockerfile.**
   `mcr.microsoft.com/devcontainers/typescript-node:22-trixie`
   (floating). Ships Node 22.x (≥ 22.12), non-root `node` user with
   passwordless sudo, git. Dev container runs no long-running services —
   e2e suites self-boot servers; production Compose boot untouched.
2. **pnpm: corepack-first, npm fallback.** Post-create runs
   `sudo corepack enable pnpm`; exact `pnpm@12.15.0` activates from the
   `packageManager` field (parity with README/runbook). If activation or
   the version check fails (bundled-corepack vs pnpm 12.15 signature
   compatibility was unverifiable from docs), fall back to
   `sudo npm install -g pnpm@12.15.0`; echo which path ran. Fresh-container
   verification settles which path executes in practice.
3. **Playwright: post-create install, not image-baked.**
   `pnpm -C apps/web exec playwright install --with-deps chromium` —
   follows the lockfile-pinned Playwright version (image-baking risks
   browser/runtime drift on dep bumps). Named volume
   `playwright-browsers` → `/home/node/.cache/ms-playwright` so
   VS Code-local rebuilds skip the browser re-download; ownership of the
   fresh volume directory ensured in the post-create script.
4. **Ports:** `forwardPorts` 3000 (API), 5173 (web dev), 4317 (prod
   probe), labeled via `portsAttributes`. Zed publishes `-p port:port`
   rather than localhost-tunneling — recorded as a per-editor note.
5. **Resources: minimums, not ceilings.** `hostRequirements`
   `{ cpus: 4, memory: 8gb, storage: 32gb }`. Codespaces filters machine
   sizes, VS Code checks-and-warns, Zed parses but ignores. No Docker
   `--memory`/`--cpus` ceilings via `runArgs` (no portable, sanctioned
   ceiling exists; imposing limits risks breaking builds).
6. **Git hooks: auto-wire in post-create, honestly guarded.** Runs the
   documented one-time `git config --local include.path …` with an
   idempotence guard (`include.path` is multi-valued). Documented image
   releases carry a feature-built Git 2.56.0 (≥ 2.54); floating-tag
   version confirmed empirically in verification. If git < 2.54 ever
   ships, hooks silently no-op — CI enforces everything they check; VS
   Code mounted-clone case writes the host clone's config (same command
   the existing docs prescribe).
7. **Shape:** `.devcontainer/devcontainer.json` +
   `.devcontainer/post-create.sh` (versioned script; runs as
   `remoteUser: node`; steps in order: pnpm setup →
   `pnpm install --frozen-lockfile` → Playwright chromium → hook
   wiring; each echoed). Zero features (no derived image build).
   `customizations.vscode.extensions` mirrors `.vscode/extensions.json`
   (oxc, eslint) plus the Svelte extension.

## Docs plan (user-directed)

- New `docs/dev-container.md` carries the full container story (design
  rationale, onboarding, per-editor parity notes, hooks behavior,
  verification recipe).
- `AGENTS.md` gets a one-line architecture-map row pointing there — no
  inlined detail.
- `docs/runbook.md` gets a lean container onboarding section linking to
  it; `README.md` a short container-alternative pointer;
  `docs/git-hooks-setup.md` a one-line cross-ref.

## Per-editor notes to record honestly

- Zed: supports image/Dockerfile/Compose configs, features (via derived
  build), and `postCreateCommand` (serial lifecycle execution; remote
  user). Parsed-but-inert: `hostRequirements`, `portsAttributes`,
  `waitFor`, `shutdownAction`. Config edits do not auto-rebuild. Feature
  flagged "still in development" upstream.
- Codespaces: same config consumed; `hostRequirements` filters machine
  sizes; only `/workspaces` persists across rebuilds (the browser volume
  benefits VS Code-local rebuilds only).
- VS Code: full property support; `hostRequirements` checked with a
  warning dialog locally.

## Open items settled empirically by fresh-container verification

- git version in the floating `22-trixie` tag (expect ≥ 2.56)
- corepack ↔ pnpm 12.15.0 signature compatibility (fallback ready)
- Node version in the floating tag (expect latest 22.x ≥ 22.12)
