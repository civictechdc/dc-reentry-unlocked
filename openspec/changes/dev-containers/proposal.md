# Proposal

## Why

Onboarding this repo onto a new machine today is manual: Node ≥ 22.12,
pnpm ≥ 12.15, Playwright browsers, hooks wiring, and the dev-boot recipe
all live in docs and must be assembled by hand. A dev container (the
open spec at containers.dev, consumed by VS Code, Zed, and GitHub
Codespaces) makes the environment reproducible in one command and keeps
every contributor/agent on the same toolchain.

## What Changes

- `.devcontainer/` configuration built against the dev container
  implementor's spec: base image or compose, Node + pnpm provisioning,
  forward of the dev/e2e ports (3000 API, 5173 web, 4317 prod probe),
  and a post-create command chain (install, Playwright browser download)
- Editor parity: the same configuration consumed by VS Code's Dev
  Containers, Zed's dev containers, and GitHub Codespaces
- Fresh-container verification: install + repo gates (deterministic set
  first, then the e2e matrix with its self-booted servers) and the dev
  boot, all inside the container
- Runbook/docs updates for the container workflow

## Capabilities

### New Capabilities

- `dev-environment`: reproducible containerized development environment
  conforming to the dev container spec, with the repo's full gate suite
  runnable inside it

### Modified Capabilities

## Impact

- **Code:** none (product untouched)
- **Build/tooling:** `.devcontainer/` (+ image/compose assets it
  references); plus `pnpm-workspace.yaml` (serialized recursive runs,
  and a rolldown `~1.2.16` override lifting the stale 1.2.15
  resolution), `apps/web/playwright.config.ts` (env-gated e2e workers
  knob), and the `svelte-kit sync &&` prefix on apps/web's test script
  (fresh-clone gate self-sufficiency) so the documented gate commands
  pass inside the container; no change to the production Compose boot
  or CI gates
- **Docs:** `docs/runbook.md` (container onboarding path)
- **Sequencing:** independent of active product changes

## Non-goals

- No CI changes (the PR/full gates stay as-is; containerizing CI is a
  separate decision)
- No production image changes (`compose.yaml` boot untouched)
- No cloud-specific beyond what Codespaces consumes from the standard
  configuration

## References

- Dev container implementor's spec: https://containers.dev/implementors/spec/
- VS Code — create dev containers:
  https://code.visualstudio.com/docs/devcontainers/create-dev-container
- Zed — dev containers: https://zed.dev/docs/dev-containers
- Dev containers org: https://github.com/devcontainers/devcontainers.github.io
- GitHub Codespaces — dev container configuration intro:
  https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers
