# DC Reentry Housing Discovery — Prototype

Display prototype: a MapLibre map + card list of available synthetic DC
reentry-housing units, with schema-driven filtering and a detail panel that
ends at provider contact info. The API boundary is the stable seam. The
validated specs and the product-design docs live in machine-local (never
committed) planning folders at the container level above this checkout's
parent directory; see `AGENTS.md` for orientation.

## Monorepo layout

| Path              | What it is                                          |
| ----------------- | --------------------------------------------------- |
| `apps/web`        | SvelteKit frontend (Svelte 5 runes, SPA mode)       |
| `apps/api`        | Fastify backend, TypeBox validation                 |
| `packages/shared` | TypeBox schemas + TS types: the API contract        |
| `tools/datagen`   | Deterministic synthetic data generator              |
| `data/`           | Frozen generated dataset (committed; deterministic) |
| `docs/`           | Human-facing docs (runbook, glossary, architecture) |

## Prerequisites

- **Node** >= 22.12 (24 LTS recommended)
- **pnpm** >= 12 (`corepack enable pnpm`)
- **git** >= 2.54 — required for the config-based hooks (see below)

## Quickstart

```sh
git clone https://github.com/civictechdc/dc-reentry-unlocked.git
cd dc-reentry-unlocked
pnpm install

# one-time: install the project git hooks (Git >= 2.54)
git config --local include.path "$(git rev-parse --show-toplevel)/gitconfig/hooks.config"
git hook list pre-commit   # sanity check
```

## Commands

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `pnpm lint`         | oxlint (JS/TS/Svelte) + ESLint (JSON only)               |
| `pnpm format`       | oxfmt — format in place                                  |
| `pnpm format:check` | oxfmt — verify formatting without writing                |
| `pnpm test`         | Vitest in every workspace (fast-check property tests)    |
| `pnpm typecheck`    | TypeScript 7 for shared/api/datagen; `tsc6` for apps/web |
| `pnpm arch:check`   | dependency-cruiser architecture rules (the seams)        |

Notes:

- TypeScript is dual-version by design: the repo standard is `typescript@^7`
  (Go-native compiler); `apps/web` pins `@typescript/typescript6` (`tsc6`
  binary) for Svelte tooling until TS 7.1 lands content-mapper support.
  dependency-cruiser's parser is likewise pinned to TS 6 via
  `pnpm-workspace.yaml` (`packageExtensions`).
- oxfmt is beta; its version is pinned exactly in the root `package.json`.
- The frozen dataset under `data/` is committed on purpose
  (byte-identical regeneration, fixed seed). Don't hand-edit it.

## Dev boot (dev servers) — status

The design runs the stack natively (`pnpm dev`: Vite + Fastify dev) and via
`docker compose up` (api + web). **Dev servers do not exist yet** — they
land with the API, web app, and compose setup (planned, not yet landed).
Until then, `pnpm dev` is intentionally undefined.

**Verification status:** the clone → install → hook setup → lint /
format:check / test / typecheck / arch:check sequence above is verified as
written. Dev-boot verification (`pnpm dev`, `docker compose up`) is deferred
until the servers exist, and will be documented in `docs/runbook.md`, as
planned.

## Git hooks (Git >= 2.54)

Config-based hooks — no husky/lefthook. `gitconfig/hooks.config` defines:

- **pre-commit** — `oxfmt --check` + `oxlint` on staged files only
- **pre-push** — full `pnpm typecheck` + `pnpm arch:check`
- **commit-msg** — commitlint (Conventional Commits)

Enable them with the `git config --local include.path ...` command in the
quickstart. Details in `docs/git-hooks-setup.md`. Commit messages follow
Conventional Commits: `type(scope): subject` — type from the conventional
enum, scope optional and aligned to the workspaces (`api`, `web`, `shared`,
`datagen`), e.g. `feat(shared): add unit card schema`.

## AI tooling

The [Svelte MCP server](https://svelte.dev/docs/ai) (Svelte 5/SvelteKit docs
lookup + the `svelte-autofixer` code validator) is configured for:

- **OpenCode** — via the `@sveltejs/opencode` plugin in the root
  `opencode.jsonc` (one entry: MCP server, skills, `svelte-file-editor`
  subagent, and Svelte instructions).
- **VS Code + Claude Code** — via the shared root `.mcp.json` (local stdio
  server, `npx -y @sveltejs/mcp@0.1.28`).
- **Codex** — via `.codex/config.toml` (`[mcp_servers.svelte]`).

Other enablement routes (official plugins for Claude Code, Codex, Cursor,
GitHub Copilot CLI) are documented at https://svelte.dev/docs/ai/overview —
this repo wires the manual configs above so nothing depends on a global
install.

Skills are committed under `.agents/skills/` (`svelte-code-writer`,
`svelte-core-bestpractices`), pinned in `skills-lock.json` against
[sveltejs/ai-tools](https://github.com/sveltejs/ai-tools). Optional upstream
skill `svelte-mcp-feedback` (autofixer-feedback reporting) is deliberately
not bundled — opt in manually if wanted. Supply-chain posture: the MCP
server (`@sveltejs/mcp@0.1.28`) and the opencode plugin
(`@sveltejs/opencode@0.1.17`) are version-pinned with the plugin
auto-update disabled — version bumps are deliberate, reviewed changes.

A specialized `svelte-file-editor` subagent is available to Claude Code
(`.claude/agents/svelte-file-editor.md`) and Codex
(`.codex/agents/svelte-file-editor.toml`); delegate Svelte component/module
work to it so docs fetching and autofixer iterations stay out of the main
context.

One-time enablement:

- **opencode** — restart; the plugin auto-loads from `opencode.jsonc`. The
  interactive `/svelte-plugin` command needs the TUI plugin registered (add
  `@sveltejs/opencode` to a global or project `tui.json`, per
  https://svelte.dev/docs/ai/opencode-plugin); without it, configure via
  `.opencode/svelte.json` directly.
- **VS Code** — trust the workspace and the server becomes available (starts
  on demand); manage it via the `MCP: List Servers` command.
- **Claude Code** — approve the project server when prompted, or manage it
  via `/mcp`.
- **Codex** — trust the project so `.codex/config.toml` and
  `.codex/agents/` load.
