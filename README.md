# DC Reentry Housing Discovery — Prototype

Display prototype: a MapLibre map + card list of available synthetic DC
reentry-housing units, with schema-driven filtering and a detail panel that
ends at provider contact info. The API boundary is the stable seam. See
`openspec/` for the validated specs and `docs/superpowers/specs/` for the
product design.

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

- TypeScript is dual-version by design (D15/D18 in the OpenSpec change design):
  the repo standard is `typescript@^7` (Go-native compiler); `apps/web` pins
  `@typescript/typescript6` (`tsc6` binary) for Svelte tooling until TS 7.1
  lands content-mapper support. dependency-cruiser's parser is likewise pinned
  to TS 6 via `pnpm-workspace.yaml` (`packageExtensions`).
- oxfmt is beta; its version is pinned exactly in the root `package.json`.
- The frozen dataset under `data/` is committed on purpose
  (byte-identical regeneration, fixed seed). Don't hand-edit it.

## Dev boot (dev servers) — status

The design runs the stack natively (`pnpm dev`: Vite + Fastify dev) and via
`docker compose up` (api + web). **Dev servers do not exist yet** — they land
with blocks 5–6 (+ 7 for the compose boot) of the OpenSpec change
`housing-units-prototype`. Until then, `pnpm dev` is intentionally undefined.

**Verification status:** the clone → install → hook setup → lint /
format:check / test / typecheck / arch:check sequence above is verified as
written. Dev-boot verification (`pnpm dev`, `docker compose up`) is deferred
to task **7.3** (`docs/runbook.md`), as planned.

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
