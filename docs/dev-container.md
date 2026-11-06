# Dev container — the full toolchain in one container

The repo ships a dev container (`.devcontainer/`): one boot gives you the
complete toolchain with nothing installed on the host beyond Docker (or
Podman) and an editor that speaks dev containers. The config targets the
[dev container implementor's spec](https://containers.dev/), so any
spec-conforming consumer works: VS Code Dev Containers, Zed, and GitHub
Codespaces.

## What it gives you

One boot pulls `mcr.microsoft.com/devcontainers/typescript-node:24-trixie`
— a floating tag, so the image stays current within the Node 24 line
(matching CI's Node 24 runtime) — and runs the post-create script, which
leaves you with:

| What                              | How it arrives                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------- |
| Node 24.x                         | baked into the image                                                              |
| pnpm 12.15.0                      | activated by post-create via corepack, from the repo's exact `packageManager` pin |
| Playwright chromium + system deps | installed by post-create at the lockfile-pinned Playwright version                |
| git hooks                         | wired by post-create (see below)                                                  |

Post-create runs `.devcontainer/post-create.sh` (~1 minute) and echoes
each step: pnpm setup, `pnpm install --frozen-lockfile`, Playwright
chromium with system dependencies, then git-hook wiring.

## Booting it

- **VS Code:** open the repo and use _Reopen in Container_ (Dev Containers
  extension). In **GitHub Codespaces**, create the space from the repo —
  both consume this config as-is.
- **Zed:** open the repo and follow Zed's dev-container flow.
- **Headless:** the reference CLI — the same engine the VS Code extension
  uses:

  ```sh
  npx @devcontainers/cli up --workspace-folder .
  # then run commands inside it:
  npx @devcontainers/cli exec --workspace-folder . pnpm test
  ```

Post-create runs at container-create time, so a rebuild re-runs it.

## Ports

Three ports are forwarded and labeled in the config:

| Port | Label          | What listens there                       |
| ---- | -------------- | ---------------------------------------- |
| 3000 | Housing API    | the API dev server (`/health`, `/units`) |
| 5173 | Web dev server | the SvelteKit dev server                 |
| 4317 | E2E prod probe | the `e2e:prod` adapter-node server       |

How reachable they are depends on the editor — stated honestly:

- **VS Code and Codespaces** tunnel forwarded ports to your local
  `localhost`.
- **Zed** publishes them with `-p port:port` — reachable on **all
  interfaces**, not just loopback. This matters for the e2e prod probe:
  its adapter-node server binds `0.0.0.0`, so while
  `pnpm -C apps/web e2e:prod` runs under Zed the static SPA shell is
  briefly LAN-reachable. The API itself binds loopback only, so no unit
  data is exposed, and CORS fails closed.

## Git hooks in the container

Post-create wires the documented one-time `include.path` (see
[git-hooks-setup.md](git-hooks-setup.md)) idempotently — if it is already
registered, the step skips. The hooks then run exactly as on the host.
They need git >= 2.54; the image ships a feature-built git (2.56.0 at
verification time). If a future image ever regressed below 2.54, the
hooks would silently not exist — CI still enforces everything they check.

Two geometry notes:

- With a bind-mounted clone (the VS Code-local flow), the config write
  lands in the host clone's `.git/config` — the same command the host
  docs prescribe.
- In a linked-worktree setup, `git config --local` writes the shared
  common config, so the include applies to every worktree of that clone.

## Resource minimums

The config's `hostRequirements` (4 CPUs / 8 GB RAM / 32 GB storage) are
spec-defined **minimums**, not container limits: Codespaces filters
machine sizes on them, VS Code checks and warns locally, and Zed
currently parses but ignores them. No CPU or memory ceilings are imposed
on the container.

## Trust model (security posture)

`.devcontainer/` is executable configuration: post-create runs repo code
at container-create time, with the image's passwordless sudo available.
Never open an untrusted branch's dev container; review `.devcontainer/`
diffs the way you review CI workflow diffs.

Deliberate hardening choices in the config:

- The browser-cache volume is named
  `dc-reentry-unlocked-playwright-browsers` precisely because Docker
  volume names are daemon-global — a generic name would let another
  project on the same daemon share (and pre-plant) the Chromium binary
  this repo executes.
- The supply chain stays pinned: dependencies install via the frozen
  lockfile (sha512 integrity hashes) under the repo's
  minimum-release-age policy, and pnpm activates via corepack from the
  exact `packageManager` pin (an npm install is the fallback only if
  corepack fails).

## Known image-package caveats

Like most fat dev images, the typescript-node image carries a
Debian-package CVE population typical of its size (openexr, mariadb
dev-libs, libxml2, vim, and imagemagick clusters at verification time).
None of it touched the Node runtime. The floating tag picks up trixie
security fixes as they land; scan with `trivy image` when it matters for
your environment.

## Verification

The end-to-end recipe, run entirely inside the container from a fresh
clone:

1. Boot it: `npx @devcontainers/cli up --workspace-folder .
   --remove-existing-container` (forces a fresh container when the
   folder was used before)
2. `pnpm install --frozen-lockfile`
3. The deterministic gates: `pnpm lint`, `pnpm format:check`,
   `pnpm test`, `pnpm typecheck`, `pnpm arch:check`
4. The three e2e suites: `pnpm -C apps/web e2e`,
   `pnpm -C apps/web e2e:bdd`, `pnpm -C apps/web e2e:prod`
5. Dev-boot probe: `pnpm dev`, then the API `/health` endpoint and the
   web app on `localhost:5173`

Verified end-to-end 2026-11-05 (fresh clone + fresh container of the
`typescript-node:24-trixie` image, reference CLI 0.90.0, 8 CPU / 12.5 GB
VM): every gate passed in the documented order — frozen install
(supply-chain policy clean), `lint`, `format:check`, `test` (384 tests),
`typecheck`, `arch:check`, then the three e2e suites (28 + 8 + 4, each
running one worker via the container's `PLAYWRIGHT_WORKERS=1`) and the
dev-boot probe (API `/health` and the web app on 5173). Wall time ~16
minutes. The CLI run exercises the same engine VS Code's Dev Containers
extension uses; the VS Code GUI attach and the Zed flow were not driven
headlessly in this session — the Zed notes above come from its current
docs and first-party source.

One caveat on the container-only knobs: the `PLAYWRIGHT_WORKERS` env
and `--init` ride Docker-level `runArgs`, verified through the
reference CLI — whether Zed and Codespaces pass `runArgs` through is
unverified, so if a consumer ignores it, e2e timing specs may need
`--workers=1` by hand.

## Troubleshooting

- **Config changes not applied:** rebuild the container — that picks up
  config changes. (Zed does not auto-rebuild on config edits; trigger
  the rebuild yourself.)
- **Playwright re-downloads chromium:** on VS Code-local rebuilds the
  named volume keeps the browser cache, so the download is skipped.
  Codespaces clears everything outside `/workspaces` on rebuilds, so it
  re-downloads there.
- **Stopping dev servers:** follow the runbook's port-hygiene guidance —
  interrupt with Ctrl-C and check listeners before rebooting
  ([runbook.md](runbook.md)).
