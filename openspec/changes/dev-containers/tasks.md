# Tasks

## 1. Tooling (repo root)

- [x] 1.1 Survey + configuration design against the dev container implementor's spec (https://containers.dev/implementors/spec/): choose base image vs compose, the Node ≥ 22.12 + pnpm ≥ 12.15 provisioning path (feature vs image vs install script), Playwright browser install in post-create, port forwards (3000 API, 5173 web, 4317 prod probe), resource ceilings worth setting, and how the git hooks (config-based, `gitconfig/hooks.config` → `scripts/hooks/`) behave on a container clone — confirm the design WITH the user before writing config
- [x] 1.2 Implement `.devcontainer/` per the confirmed design, consumable by VS Code Dev Containers (https://code.visualstudio.com/docs/devcontainers/create-dev-container), Zed (https://zed.dev/docs/dev-containers), and GitHub Codespaces (https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers)
- [ ] 1.3 Verify in a FRESH container: `pnpm install --frozen-lockfile`, the deterministic gates (`pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`), then `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` (self-booted servers) and the dev boot (`pnpm dev`, web on 5173 + API on 3000) all pass inside it
- [ ] 1.4 Editor parity + docs: open the same configuration through VS Code's and Zed's dev-container flows (record any per-editor notes honestly), update `docs/runbook.md` with the container onboarding path, and confirm the container story does not drift from the fresh-clone verification story already documented

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve
  findings, then archive this change (`openspec archive`) and verify the
  archived specs.
